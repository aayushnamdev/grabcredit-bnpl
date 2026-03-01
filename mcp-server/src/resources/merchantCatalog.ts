import { Transaction } from '../types';

export const RESOURCE_DEFINITION = {
  uri: 'merchant://catalog',
  name: 'Merchant Catalog',
  description: 'Unique merchants grouped by category, extracted from transaction history.',
  mimeType: 'application/json',
};

export function buildMerchantCatalog(transactions: Transaction[]): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  const categories: Record<string, Set<string>> = {};

  for (const t of transactions) {
    if (!categories[t.merchant_category]) {
      categories[t.merchant_category] = new Set();
    }
    categories[t.merchant_category].add(t.merchant_name);
  }

  const categoriesResult: Record<string, string[]> = {};
  let totalMerchants = 0;
  const allMerchants = new Set<string>();

  for (const [cat, merchants] of Object.entries(categories)) {
    const sorted = [...merchants].sort();
    categoriesResult[cat] = sorted;
    sorted.forEach(m => allMerchants.add(m));
  }
  totalMerchants = allMerchants.size;

  const catalog = {
    total_merchants: totalMerchants,
    categories: categoriesResult,
  };

  return {
    contents: [{
      uri: RESOURCE_DEFINITION.uri,
      mimeType: RESOURCE_DEFINITION.mimeType,
      text: JSON.stringify(catalog, null, 2),
    }],
  };
}
