import client from './redis-client';
import { Product } from './types';

const PRODUCTS: Product[] = [
  {
    id: 'SKU001',
    title: 'Apple MacBook Air M2 2024 8CPU 8GPU 16GB 256GB',
    image: 'apple-mac-book-air-m2-2024-8-cpu-8-gpu-16-gb-256-gb.webp',
    price: 21590000,
    quantity: 1
  },
  {
    id: 'SKU002',
    title: 'Mac mini M4 2024 10CPU 10GPU 24GB 512GB',
    image: 'mac-mini-m4-2024-10-cpu-10-gpu-24-gb-512-gb.webp',
    price: 24990000,
    quantity: 1
  },
  {
    id: 'SKU003',
    title: 'iPhone 16 Pro Max 256GB',
    image: 'iphone-16-pro-max-256-gb.webp',
    price: 30990000,
    quantity: 1
  },
  {
    id: 'SKU004',
    title: 'iPad Pro M4 11 inch Wifi 256GB',
    image: 'ipad-pro-m4-11-inch-wifi-256-gb.webp',
    price: 27990000,
    quantity: 1
  },
  {
    id: 'SKU005',
    title: 'Apple Watch Series 10 46mm (GPS) Viền Nhôm Dây Cao Su Size S/M',
    image: 'apple-watch-series-10-46-mm-gps-vien-nhom-day-cao-su-size-s-m.webp',
    price: 10990000,
    quantity: 1
  },
  {
    id: 'SKU006',
    title: 'Tai nghe Bluetooth Apple AirPods 4',
    image: 'tai-nghe-bluetooth-apple-airpods-4.webp',
    price: 3290000,
    quantity: 1,
  },
  {
    id: 'SKU007',
    title: 'Apple AirTag',
    image: 'apple-air-tag.webp',
    price: 790000,
    quantity: 2
  }
];

async function createCart(userId: string, products: Product[]) {
  const cartId = `cart:${userId}`;

  await client.sAdd('carts', cartId); // add to set
  await client.sAdd(`${cartId}:products`, products.map(prod => prod.id)); // add to set
  await client.set(`${cartId}:isPaid`, '0');

  for (const prod of products) {
    await client.hSet(`${cartId}:product:${prod.id}`, {
      id: prod.id,
      title: prod.title,
      image: prod.image,
      price: prod.price.toString(),
      quantity: prod.quantity.toString(),
    }); // add to hash
  }

  console.log('Cart created', cartId);
}

async function getAllCartIds(): Promise<string[]> {
  return await client.sMembers('carts');
}

async function findUnpaidCarts(): Promise<string[]> {
  const cartIds = await getAllCartIds();
  const unpaid: string[] = [];

  for (const id of cartIds) {
    const isPaid = await client.get(`${id}:isPaid`);
    if (isPaid === '0') unpaid.push(id);
  }

  return unpaid;
}

async function cartsWithMoreThanFiveItems(): Promise<string[]> {
  const cartIds = await getAllCartIds();
  const result: string[] = [];

  for (const id of cartIds) {
    const count = await client.sCard(`${id}:products`);
    if (count > 5) result.push(id);
  }

  return result;
}

async function countCartsWithProduct(productId: string): Promise<number> {
  const cartIds = await getAllCartIds();

  let count = 0;

  for (const cartId of cartIds) {
    const hasProduct = await client.sIsMember(`${cartId}:products`, productId);
    if (hasProduct) ++count;
  }

  return count;
}

async function calculateCartTotal(cartId: string): Promise<number> {
  const productIds = await client.sMembers(`${cartId}:products`);

  let total = 0;

  for (const productId of productIds) {
    const data = await client.hGetAll(`${cartId}:product:${productId}`);
    total += parseInt(data.price) * parseInt(data.quantity);
  }

  return total;
}

async function getCartsByUser(userId: string): Promise<string[]> {
  const cartIds = await getAllCartIds();
  return cartIds.filter((cartId) => cartId.startsWith(`cart:${userId}`));
}

async function removeProduct(cartId: string, productId: string) {
  await client.sRem(`${cartId}:products`, productId); // remove from set
  await client.del(`${cartId}:product:${productId}`); // delete product
}

async function incrementProduct(cartId: string, productId: string) {
  await client.hIncrBy(`${cartId}:product:${productId}`, 'quantity', 1); // increment quantity
}

async function clearCart(cartId: string) {
  const productIds = await client.sMembers(`${cartId}:products`);

  for (const productId of productIds) {
    await client.del(`${cartId}:product:${productId}`); // delete product
  }

  await client.del(`${cartId}:products`); // delete set
}

async function findCartWithMaxTotal(): Promise<{ cartId: string | null, total: number }> {
  const cartIds = await getAllCartIds();

  let maxTotal = 0;
  let maxCartId: string | null = null;

  for (const cartId of cartIds) {
    const total = await calculateCartTotal(cartId);

    if (total > maxTotal) {
      maxTotal = total;
      maxCartId = cartId;
    }
  }

  return {
    cartId: maxCartId,
    total: maxTotal
  };
}

async function getMostFrequentProduct(): Promise<{ productId: string | null, count: number }> {
  const cartIds = await getAllCartIds();

  const counter: Record<string, number> = {};

  for (const cartId of cartIds) {
    const productIds = await client.sMembers(`${cartId}:products`);

    for (const productId of productIds) {
      counter[productId] = (counter[productId] || 0) + 1;
    }
  }

  if (!Object.keys(counter).length) {
    return {
      productId: null,
      count: 0
    };
  }

  const sorted = Object.entries(counter).sort((a, b) => {
    const countA = a[1];
    const countB = b[1];
    return countB - countA;
  });

  const maxProduct = sorted[0];
  const maxProductId = maxProduct[0];
  const maxCount = maxProduct[1];

  return {
    productId: maxProductId,
    count: maxCount
  };
}

(async () => {
  await createCart('ncdai-1', PRODUCTS);
  await createCart('ncdai-2', [PRODUCTS[0], PRODUCTS[1], PRODUCTS[2]]);
  console.log('findUnpaidCarts', await findUnpaidCarts());
  console.log('cartsWithMoreThanFiveItems', await cartsWithMoreThanFiveItems());
  console.log('countCartsWithProduct', await countCartsWithProduct('SKU002'));
  console.log('calculateCartTotal', await calculateCartTotal('cart:ncdai-1'));
  console.log('getCartsByUser', await getCartsByUser('ncdai'));
  // await removeProduct('cart:ncdai-1', 'SKU002');
  // await incrementProduct('cart:ncdai-1', 'SKU007');
  // await clearCart('cart:ncdai-1');
  console.log('findCartWithMaxTotal', await findCartWithMaxTotal());
  console.log('getMostFrequentProduct', await getMostFrequentProduct());
})();
