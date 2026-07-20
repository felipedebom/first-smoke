import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const numberValue = (value) => Number(value || 0);

export async function registerHistory(user, acao, tipo = 'sistema') {
  await addDoc(collection(db, 'logs'), {
    usuario: user?.email || 'Sistema',
    usuarioId: user?.uid || null,
    acao,
    tipo,
    data: serverTimestamp(),
  });
}

export async function registerStockEntry({ productId, quantity, note, user }) {
  const productRef = doc(db, 'produtos', productId);
  const entryRef = doc(collection(db, 'entradas'));
  const logRef = doc(collection(db, 'logs'));
  const safeQuantity = numberValue(quantity);

  if (safeQuantity <= 0) throw new Error('Informe uma quantidade maior que zero.');

  return runTransaction(db, async (transaction) => {
    const productSnapshot = await transaction.get(productRef);

    if (!productSnapshot.exists()) throw new Error('Produto não encontrado.');

    const product = productSnapshot.data();
    const newStock = numberValue(product.estoque) + safeQuantity;

    transaction.update(productRef, {
      estoque: newStock,
      atualizadoEm: serverTimestamp(),
    });

    transaction.set(entryRef, {
      produtoId: productId,
      produtoNome: product.nome,
      quantidade: safeQuantity,
      tipo: 'Entrada',
      observacao: note.trim(),
      usuario: user?.email || 'Sistema',
      usuarioId: user?.uid || null,
      data: serverTimestamp(),
    });

    transaction.set(logRef, {
      usuario: user?.email || 'Sistema',
      usuarioId: user?.uid || null,
      acao: `Registrou entrada de ${safeQuantity} unidade(s) de ${product.nome}`,
      tipo: 'entrada',
      data: serverTimestamp(),
    });

    return { productName: product.nome, newStock };
  });
}

export async function completeSale({ items, paymentMethod, receivedAmount, customerName, user }) {
  if (!items.length) throw new Error('Adicione ao menos um produto à venda.');

  const saleRef = doc(collection(db, 'vendas'));
  const receivableRef = paymentMethod === 'Fiado' ? doc(collection(db, 'fiados')) : null;
  const logRef = doc(collection(db, 'logs'));
  const safeReceivedAmount = numberValue(receivedAmount);

  return runTransaction(db, async (transaction) => {
    const products = await Promise.all(items.map(async (item) => {
      const productRef = doc(db, 'produtos', item.produtoId);
      const productSnapshot = await transaction.get(productRef);

      if (!productSnapshot.exists()) throw new Error(`O produto ${item.nome} não existe mais.`);

      return { item, productRef, product: productSnapshot.data() };
    }));

    const saleItems = products.map(({ item, productRef, product }) => {
      const stock = numberValue(product.estoque);
      const quantity = numberValue(item.quantidade);

      if (!product.ativo) throw new Error(`${product.nome} está inativo e não pode ser vendido.`);
      if (quantity <= 0) throw new Error(`Quantidade inválida para ${product.nome}.`);
      if (stock < quantity) throw new Error(`Estoque insuficiente para ${product.nome}. Disponível: ${stock}.`);

      transaction.update(productRef, {
        estoque: stock - quantity,
        atualizadoEm: serverTimestamp(),
      });

      const unitPrice = numberValue(product.precoVenda ?? product.preco);
      return {
        produtoId: item.produtoId,
        nome: product.nome,
        categoria: product.categoria || 'Outros',
        quantidade: quantity,
        precoUnitario: unitPrice,
        precoCusto: numberValue(product.precoCusto),
        subtotal: unitPrice * quantity,
      };
    });

    const total = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
    const change = paymentMethod === 'Dinheiro' ? Math.max(safeReceivedAmount - total, 0) : 0;

    transaction.set(saleRef, {
      itens: saleItems,
      subtotal: total,
      total,
      pagamento: paymentMethod,
      valorRecebido: paymentMethod === 'Dinheiro' ? safeReceivedAmount : null,
      troco: change,
      clienteNome: paymentMethod === 'Fiado' ? customerName.trim() : '',
      status: 'Concluída',
      usuario: user?.email || 'Sistema',
      usuarioId: user?.uid || null,
      data: serverTimestamp(),
    });

    if (receivableRef) {
      transaction.set(receivableRef, {
        clienteNome: customerName.trim(),
        vendaId: saleRef.id,
        valor: total,
        status: 'Em aberto',
        criadoPor: user?.email || 'Sistema',
        data: serverTimestamp(),
      });
    }

    transaction.set(logRef, {
      usuario: user?.email || 'Sistema',
      usuarioId: user?.uid || null,
      acao: `Concluiu venda de ${saleItems.length} item(ns), total de R$ ${total.toFixed(2)}`,
      tipo: 'venda',
      data: serverTimestamp(),
    });

    return { total, change, saleId: saleRef.id };
  });
}

export async function settleReceivable(receivable, receivedAmount, user) {
  const paymentValue = numberValue(receivedAmount);

  if (paymentValue <= 0) {
    throw new Error('Informe um valor de pagamento maior que zero.');
  }

  const receivableRef = doc(db, 'fiados', receivable.id);
  const logRef = doc(collection(db, 'logs'));

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(receivableRef);
    if (!snapshot.exists()) throw new Error('Fiado não encontrado.');
    const current = snapshot.data();
    const currentBalance = numberValue(current.saldoPendente ?? current.valor);
    if (paymentValue > currentBalance) throw new Error('O pagamento não pode ser maior que o saldo pendente.');
    const remainingAmount = Number((currentBalance - paymentValue).toFixed(2));
    const isFullyPaid = remainingAmount <= 0;

    transaction.update(receivableRef, {
      valorOriginal: numberValue(current.valorOriginal ?? current.valor),
      saldoPendente: isFullyPaid ? 0 : remainingAmount,
      valorPago: numberValue(current.valorPago) + paymentValue,
      status: isFullyPaid ? 'Pago' : 'Parcial',
      atualizadoEm: serverTimestamp(),
      pagoEm: isFullyPaid ? serverTimestamp() : null,
      pagoPor: user?.email || 'Sistema',
    });
    transaction.set(logRef, {
      usuario: user?.email || 'Sistema',
      usuarioId: user?.uid || null,
      acao: isFullyPaid
        ? `Quitou o fiado de ${current.clienteNome} no valor de R$ ${paymentValue.toFixed(2)}`
        : `Registrou pagamento parcial de R$ ${paymentValue.toFixed(2)} para ${current.clienteNome}`,
      tipo: 'fiado',
      data: serverTimestamp(),
    });
    return { remainingAmount };
  });
}
