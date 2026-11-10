// Cedis with exactly two decimals ("₵1,234.50"): receipts and customer sheets.
export const money = (n: number) => `₵${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
