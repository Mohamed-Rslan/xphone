import { formatEGP, formatDateTime, formatDate } from './utils'

/**
 * Format Egyptian phone number to international WhatsApp format (e.g., 01012345678 -> 201012345678)
 */
export function formatWhatsAppPhone(phone?: string | null): string {
  if (!phone) return ''
  let cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '2' + cleaned
  } else if (!cleaned.startsWith('2') && cleaned.length === 10) {
    cleaned = '20' + cleaned
  }
  return cleaned
}

/**
 * Safely open WhatsApp Web or Desktop Application with encoded text
 */
export function openWhatsApp(phone: string | null | undefined, message: string): boolean {
  const cleanPhone = formatWhatsAppPhone(phone)
  const encodedMsg = encodeURIComponent(message)
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`
    : `https://api.whatsapp.com/send?text=${encodedMsg}`

  try {
    const newWin = window.open(url, '_blank')
    if (!newWin) {
      window.location.href = url
    }
    return true
  } catch (e) {
    console.error('Error opening WhatsApp URL:', e)
    return false
  }
}

/**
 * Build & Send Sales Receipt via WhatsApp
 */
export function shareSaleReceiptWhatsApp(sale: any, storeName: string = 'متجر XPhone', phoneOverride?: string) {
  if (!sale) return

  const phone = phoneOverride || sale.customer_phone || sale.phone || ''
  let msg = `*🧾 إيصال فاتورة شراء من ${storeName}*\n`
  msg += `------------------------------------\n`
  msg += `🔢 رقم الفاتورة: *${sale.invoice_no || sale.id}*\n`
  msg += `📅 التاريخ: ${formatDateTime(sale.created_at || new Date().toISOString())}\n`
  msg += `👤 العميل: ${sale.customer_name || 'عميل نقدي'}\n`
  msg += `------------------------------------\n`
  msg += `📦 *المنتجات والمشتريات:*\n`

  if (sale.items && Array.isArray(sale.items)) {
    sale.items.forEach((item: any, idx: number) => {
      const itemTotal = (item.unit_price * item.qty) - (item.discount || 0)
      msg += `${idx + 1}. *${item.name_ar || item.product_name}* (العدد: ${item.qty}) - ${formatEGP(itemTotal)}\n`
    })
  }

  msg += `------------------------------------\n`
  if (sale.discount > 0) {
    msg += `🔻 الخصم: ${formatEGP(sale.discount)}\n`
  }
  msg += `💰 *الإجمالي النهائي: ${formatEGP(sale.total)}*\n`
  if (sale.cash_amount > 0 || sale.card_amount > 0) {
    msg += `💳 المدفوع: ${formatEGP((sale.cash_amount || 0) + (sale.card_amount || 0))}\n`
  }
  msg += `------------------------------------\n`
  msg += `شكراً لزيارتكم وتثمين ثقتكم بنا! 🌹`

  return openWhatsApp(phone, msg)
}

/**
 * Build & Send Financial Service (Monetary) Receipt via WhatsApp
 */
export function shareMonetaryReceiptWhatsApp(tx: any, storeName: string = 'متجر XPhone', phoneOverride?: string) {
  if (!tx) return

  const phone = phoneOverride || tx.customer_phone || tx.phone || ''
  const serviceTypeAr =
    tx.service_type === 'cash_in' ? 'إيداع/شحن مالي' :
    tx.service_type === 'cash_out' ? 'سحب/صرف مالي' :
    tx.service_type === 'bill_payment' ? 'سداد فواتير واستحقاق' :
    tx.service_type_name || 'خدمة مالية'

  let msg = `*💸 إيصال معاملة خدمة مالية - ${storeName}*\n`
  msg += `------------------------------------\n`
  msg += `📌 نوع المعاملة: *${serviceTypeAr}*\n`
  msg += `🔢 رقم الإيصال/المرجع: *${tx.receipt_no || tx.id}*\n`
  msg += `📅 التاريخ والوقت: ${formatDateTime(tx.created_at || new Date().toISOString())}\n`
  if (tx.account_number || tx.target_number) {
    msg += `📱 رقم المحفظة/الحساب: *${tx.account_number || tx.target_number}*\n`
  }
  msg += `------------------------------------\n`
  msg += `💵 *المبلغ الأساسي: ${formatEGP(tx.amount || 0)}*\n`
  if (tx.commission > 0 || tx.fee > 0) {
    msg += `📈 الرسوم/العمولة: ${formatEGP(tx.commission || tx.fee || 0)}\n`
  }
  msg += `💰 *إجمالي المعاملة: ${formatEGP((tx.amount || 0) + (tx.commission || 0))}*\n`
  msg += `------------------------------------\n`
  msg += `تم تنفيذ المعاملة بنجاح بنسبة 100%. شكراً لاستخدامكم خدماتنا المالية! 🚀`

  return openWhatsApp(phone, msg)
}

/**
 * Build & Send Maintenance & Repair Ticket / Status Receipt via WhatsApp
 */
export function shareRepairTicketWhatsApp(repair: any, storeName: string = 'متجر XPhone', phoneOverride?: string) {
  if (!repair) return

  const phone = phoneOverride || repair.customer_phone || repair.phone || ''
  const statusAr =
    repair.status === 'delivered' ? '✅ تم التسليم بنجاح' :
    repair.status === 'repaired' ? '🎉 تم الإصلاح وجاهز للتسليم' :
    repair.status === 'in_progress' ? '⚙️ جاري الإصلاح والصيانة' :
    repair.status === 'received' ? '📥 تم الاستلام بفحص الصيانة' :
    repair.status === 'cancelled' ? '❌ متعذر الإصلاح / ملغاة' : repair.status

  let msg = `*🔧 كارت استلام/تسليم صيانة - ${storeName}*\n`
  msg += `------------------------------------\n`
  msg += `🔢 رقم إيصال الصيانة: *${repair.ticket_no || repair.id}*\n`
  msg += `📱 نوع الجهاز والمركة: *${repair.device_model || repair.device_name}*\n`
  if (repair.imei) {
    msg += `🔢 الرقم التسلسلي (IMEI): ${repair.imei}\n`
  }
  msg += `🛠️ عطل الجهاز الموضح: ${repair.issue_description || repair.problem || 'صيانة عامة'}\n`
  msg += `------------------------------------\n`
  msg += `📊 حالة الصيانة الحالية: *${statusAr}*\n`
  msg += `📅 تاريخ الاستلام: ${formatDate(repair.created_at || new Date().toISOString())}\n`
  if (repair.cost > 0) {
    msg += `💵 تكلفة الصيانة المقدرة: *${formatEGP(repair.cost)}*\n`
  }
  msg += `------------------------------------\n`
  msg += `نسعد بخدمتكم وتوفير قطع الغيار الأصلية مع الضمان! 📱✨`

  return openWhatsApp(phone, msg)
}
