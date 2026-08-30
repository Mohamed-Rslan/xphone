import { create } from 'zustand'

export interface CartItem {
  product_id: string
  name_ar: string
  brand_name: string | null
  unit_price: number
  unit_cost: number
  qty: number
  discount: number
}

interface CartState {
  items: CartItem[]
  customerId: string | null
  cartDiscount: number
  addItem: (item: Omit<CartItem, 'qty' | 'discount'>) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  setItemDiscount: (productId: string, discount: number) => void
  setCustomer: (id: string | null) => void
  setCartDiscount: (discount: number) => void
  updatePrice: (productId: string, price: number) => void
  clear: () => void
  subtotal: () => number
  total: () => number
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  customerId: null,
  cartDiscount: 0,

  addItem: (newItem) => {
    const items = get().items
    const existing = items.find(i => i.product_id === newItem.product_id)
    if (existing) {
      set({ items: items.map(i => i.product_id === newItem.product_id ? { ...i, qty: i.qty + 1 } : i) })
    } else {
      set({ items: [...items, { ...newItem, qty: 1, discount: 0 }] })
    }
  },

  removeItem: (productId) => set({ items: get().items.filter(i => i.product_id !== productId) }),

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId)
    } else {
      set({ items: get().items.map(i => i.product_id === productId ? { ...i, qty } : i) })
    }
  },

  setItemDiscount: (productId, discount) =>
    set({ items: get().items.map(i => i.product_id === productId ? { ...i, discount } : i) }),

  setCustomer: (id) => set({ customerId: id }),
  setCartDiscount: (discount) => set({ cartDiscount: discount }),
  updatePrice: (productId, price) =>
    set({ items: get().items.map(i => i.product_id === productId ? { ...i, unit_price: price } : i) }),
  clear: () => set({ items: [], customerId: null, cartDiscount: 0 }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.unit_price * i.qty - i.discount, 0),
  total: () => get().subtotal() - get().cartDiscount,
}))
