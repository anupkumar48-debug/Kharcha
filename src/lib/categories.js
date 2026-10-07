export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', icon: '🍔', color: '#f97316' },
  { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#16a34a' },
  { id: 'travel', name: 'Travel & Fuel', icon: '🚕', color: '#0ea5e9' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#db2777' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡', color: '#eab308' },
  { id: 'rent', name: 'Rent & Home', icon: '🏠', color: '#8b5cf6' },
  { id: 'emi', name: 'EMI / Installment', icon: '📅', color: '#dc2626' },
  { id: 'health', name: 'Health', icon: '💊', color: '#14b8a6' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#6366f1' },
  { id: 'education', name: 'Education', icon: '📚', color: '#0d9488' },
  { id: 'investment', name: 'Investment', icon: '📈', color: '#059669' },
  { id: 'udhar', name: 'Udhar', icon: '🤝', color: '#a16207' },
  { id: 'transfer', name: 'Transfers', icon: '🔁', color: '#64748b' },
  { id: 'income', name: 'Income', icon: '💰', color: '#15803d' },
  { id: 'other', name: 'Other', icon: '📦', color: '#94a3b8' },
];

const RULES = [
  ['food', /swiggy|zomato|domino|pizza|mcdonald|kfc|burger|starbucks|cafe|restaurant|eatsure|haldiram|chaayos|dunzo daily|biryani/i],
  ['groceries', /blinkit|zepto|bigbasket|grofers|dmart|jiomart|instamart|more retail|reliance fresh|spencer|nature'?s basket|kirana|grocery/i],
  ['travel', /uber|ola|rapido|irctc|redbus|makemytrip|goibibo|indigo|air ?india|vistara|akasa|metro|fastag|petrol|hpcl|bpcl|iocl|indian oil|shell|fuel|cleartrip|yatra|ixigo/i],
  ['shopping', /amazon|flipkart|myntra|ajio|meesho|nykaa|tata ?cliq|croma|reliance digital|decathlon|lifestyle|westside|ikea|snapdeal/i],
  ['bills', /airtel|jio|vodafone|\bvi\b|bsnl|electricity|bescom|tata power|adani|mseb|water|gas|broadband|act fibernet|recharge|dth|tatasky|tata play|bill ?desk|billpay|postpaid|lic/i],
  ['rent', /rent|nobroker|housing|society|maintenance|urban company/i],
  ['emi', /\bemi\b|loan|bajaj fin|home ?credit|nach|ach d/i],
  ['health', /1mg|pharm|apollo|medplus|netmeds|pharmeasy|hospital|clinic|diagnostic|lab|practo|cult\.?fit|healthkart/i],
  ['entertainment', /netflix|prime video|hotstar|spotify|youtube|bookmyshow|pvr|inox|sony ?liv|zee5|gaana|steam|playstation/i],
  ['education', /school|college|university|udemy|coursera|byju|unacademy|fees|tuition/i],
  ['investment', /zerodha|groww|upstox|kuvera|mutual fund|\bsip\b|nps|ppf|coin by|smallcase|angel one|indmoney/i],
  ['transfer', /neft|imps|rtgs|self transfer|to self/i],
];

/** learned = { merchantLower: categoryId } — user corrections take priority */
export function guessCategory(txn, learned = {}) {
  const m = (txn.merchant || '').toLowerCase();
  if (m && learned[m]) return learned[m];
  if (txn.type === 'credit') return /refund|reversal|cashback/i.test(txn.raw || '') ? 'other' : 'income';
  if (txn.isEmi) return 'emi';
  const hay = `${txn.merchant || ''} ${txn.raw || ''} ${txn.note || ''}`;
  for (const [id, re] of RULES) if (re.test(hay)) return id;
  if (txn.mode === 'ATM/Cash') return 'other';
  return 'other';
}
