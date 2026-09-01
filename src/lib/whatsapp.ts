import { formatEGP, formatDateTime, formatDate } from './utils'
import { useWhatsAppStore } from '../store/whatsappStore'
import { useSettingsStore } from '../store/settingsStore'

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
 * Open WhatsApp side drawer popup in UI (نافذة منبثقة جانبية)
 * Does NOT navigate window.location, allowing the user to close it without closing the app.
 */
export function openWhatsApp(phone: string | null | undefined, message: string, title?: string, recipientName?: string): boolean {
  useWhatsAppStore.getState().openWhatsAppDrawer({
    phone,
    message,
    title: title || 'رسالة الواتساب',
    recipientName,
  })
  return true
}

/**
 * Build & Send Sales Receipt via WhatsApp (using drawer & settings)
 */
export function shareSaleReceiptWhatsApp(sale: any, storeNameParam?: string, phoneOverride?: string) {
  if (!sale) return

  const { storeName, waSaleHeader, waFooterNote, waTagline } = useSettingsStore.getState()
  const activeStoreName = storeNameParam || storeName || 'متجر XPhone'

  const phone = phoneOverride || sale.customer_phone || sale.phone || ''
  const recipientName = sale.customer_name || 'عميل نقدي'

  let headerText = (waSaleHeader || '🧾 إيصال فاتورة شراء من {{storeName}}')
    .replace('{{storeName}}', activeStoreName)

  let msg = `*${headerText}*\n`
  msg += `------------------------------------\n`
  msg += `🔢 رقم الفاتورة: *${sale.invoice_no || sale.id}*\n`
  msg += `📅 التاريخ: ${formatDateTime(sale.created_at || new Date().toISOString())}\n`
  msg += `👤 العميل: ${recipientName}\n`
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
  msg += `${waFooterNote || 'شكراً لزيارتكم وتثمين ثقتكم بنا!'}`
  if (waTagline) {
    msg += `\n${waTagline}`
  }

  return openWhatsApp(phone, msg, 'إيصال فاتورة مبيعات', recipientName)
}

/**
 * Build & Send Financial Service (Monetary) Receipt via WhatsApp
 */
export function shareMonetaryReceiptWhatsApp(tx: any, storeNameParam?: string, phoneOverride?: string) {
  if (!tx) return

  const { storeName, waMonetaryHeader, waFooterNote, waTagline } = useSettingsStore.getState()
  const activeStoreName = storeNameParam || storeName || 'متجر XPhone'

  const phone = phoneOverride || tx.customer_phone || tx.phone || ''
  const recipientName = tx.customer_name || 'عميل خدمات مالية'

  const serviceTypeAr =
    tx.service_type === 'cash_in' ? 'إيداع/شحن مالي' :
    tx.service_type === 'cash_out' ? 'سحب/صرف مالي' :
    tx.service_type === 'bill_payment' ? 'سداد فواتير واستحقاق' :
    tx.service_type_name || 'خدمة مالية'

  let headerText = (waMonetaryHeader || '💸 إيصال معاملة خدمة مالية - {{storeName}}')
    .replace('{{storeName}}', activeStoreName)

  let msg = `*${headerText}*\n`
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
  msg += `تم تنفيذ المعاملة بنجاح بنسبة 100%. ${waFooterNote || 'شكراً لاستخدامكم خدماتنا المالية!'}`
  if (waTagline) {
    msg += `\n${waTagline}`
  }

  return openWhatsApp(phone, msg, 'إيصال خدمة مالية', recipientName)
}

/**
 * Build & Send Maintenance & Repair Ticket / Status Receipt via WhatsApp
 */
export function shareRepairTicketWhatsApp(repair: any, storeNameParam?: string, phoneOverride?: string) {
  if (!repair) return

  const { storeName, waRepairHeader, waFooterNote, waTagline } = useSettingsStore.getState()
  const activeStoreName = storeNameParam || storeName || 'متجر XPhone'

  const phone = phoneOverride || repair.customer_phone || repair.phone || ''
  const recipientName = repair.customer_name || 'عميل صيانة'

  const statusAr =
    repair.status === 'delivered' ? '✅ تم التسليم بنجاح والتوريد للخزينة' :
    repair.status === 'repaired' ? '🎉 تم الإصلاح وجاهز للتسليم' :
    repair.status === 'in_progress' ? '⚙️ جاري الإصلاح والصيانة' :
    repair.status === 'received' ? '📥 تم الاستلام بفحص الصيانة' :
    repair.status === 'cancelled' ? '❌ متعذر الإصلاح / ملغاة' : repair.status

  // Official Repair Job / Ticket Code
  const ticketNo = repair.job_no || repair.ticket_no || repair.ticket_number || (repair.id ? repair.id.slice(0, 8).toUpperCase() : '—')

  // Full device name & brand
  const deviceName = [repair.device_brand_name, repair.device_model || repair.device_name].filter(Boolean).join(' ') || 'جهاز صيانة'

  let headerText = (waRepairHeader || '🔧 كارت استلام/تسليم صيانة - {{storeName}}')
    .replace('{{storeName}}', activeStoreName)

  let msg = `*${headerText}*\n`
  msg += `------------------------------------\n`
  msg += `🔢 رقم إيصال الصيانة: *${ticketNo}*\n`
  msg += `📱 نوع الجهاز والماركة: *${deviceName}*\n`
  if (repair.imei) {
    msg += `🔢 الرقم التسلسلي (IMEI): ${repair.imei}\n`
  }
  msg += `🛠️ عطل الجهاز الموضح: ${repair.fault_desc || repair.issue_description || repair.problem || 'صيانة عامة'}\n`
  msg += `------------------------------------\n`
  msg += `📊 حالة الصيانة الحالية: *${statusAr}*\n`
  msg += `📅 تاريخ الاستلام: ${formatDate(repair.received_at || repair.created_at || new Date().toISOString())}\n`
  if (repair.delivered_at) {
    msg += `📅 تاريخ التسليم النهائي: ${formatDate(repair.delivered_at)}\n`
  }

  // Costs & Paid Amount
  const paidAmount = repair.amount_paid ?? repair.paid_amount ?? repair.total_cost ?? repair.cost ?? 0
  const totalCost = repair.total_cost ?? repair.cost ?? paidAmount

  if (repair.status === 'delivered') {
    msg += `💰 إجمالي المبلغ المدفوع للصيانة: *${formatEGP(paidAmount > 0 ? paidAmount : totalCost)}*\n`
    msg += `🏦 حالة السداد: *تم السداد بالكامل والتوريد للحساب النقدي* 💵\n`
  } else {
    if (totalCost > 0) {
      msg += `💵 تكلفة الصيانة المقدرة: *${formatEGP(totalCost)}*\n`
    }
    if (paidAmount > 0 && paidAmount < totalCost) {
      msg += `💳 المدفوع مقدماً (عربون): *${formatEGP(paidAmount)}*\n`
      msg += `⏳ المتبقي عند التسليم: *${formatEGP(totalCost - paidAmount)}*\n`
    }
  }

  msg += `------------------------------------\n`
  msg += `نسعد بخدمتكم وتوفير قطع الغيار الأصلية مع الضمان! 📱✨`
  if (waTagline) {
    msg += `\n${waTagline}`
  }

  return openWhatsApp(phone, msg, 'كارت صيانة جهاز', recipientName)
}
