import * as XLSX from 'xlsx-js-style'
import {
  getExpenses, getProfitLoss, getRepairJobs, getMonetaryTransactions,
  getSales, getPurchaseOrders, getCashMovementsReport, getDamagedGoods
} from './commands'
import { formatEGP, formatDate, formatDateTime, today } from './utils'
import { invoke } from '@tauri-apps/api/core'

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 EXECUTIVE PROFESSIONAL EXCEL DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  title: {
    font: { name: 'Cairo', sz: 14, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "0F172A" } }, // Deep Midnight Executive Navy
    alignment: { horizontal: "center", vertical: "center" }
  },
  subtitle: {
    font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: "334155" } },
    fill: { fgColor: { rgb: "F1F5F9" } }, // Soft Slate Ice
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      bottom: { style: "medium", color: { rgb: "CBD5E1" } }
    }
  },
  header: {
    font: { name: 'Cairo', sz: 10.5, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E293B" } }, // Dark Slate Table Header
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "medium", color: { rgb: "0F172A" } },
      bottom: { style: "medium", color: { rgb: "0F172A" } },
      left: { style: "thin", color: { rgb: "475569" } },
      right: { style: "thin", color: { rgb: "475569" } }
    }
  },
  dataEven: {
    font: { name: 'Cairo', sz: 9.5, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } }
    }
  },
  dataOdd: {
    font: { name: 'Cairo', sz: 9.5, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: "F8FAFC" } }, // Subtle zebra row
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } }
    }
  },
  boldData: {
    font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: "F1F5F9" } },
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } }
    }
  },
  totalRow: {
    font: { name: 'Cairo', sz: 10.5, bold: true, color: { rgb: "1E1B4B" } },
    fill: { fgColor: { rgb: "EEF2FF" } }, // Royal Indigo Accent Ice
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "medium", color: { rgb: "6366F1" } },
      bottom: { style: "double", color: { rgb: "4338CA" } },
      left: { style: "thin", color: { rgb: "C7D2FE" } },
      right: { style: "thin", color: { rgb: "C7D2FE" } }
    }
  },
  positive: {
    font: { name: 'Cairo', sz: 9.5, bold: true, color: { rgb: "065F46" } }, // Emerald Text
    fill: { fgColor: { rgb: "D1FAE5" } }, // Mint Background
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "A7F3D0" } },
      bottom: { style: "thin", color: { rgb: "A7F3D0" } },
      left: { style: "thin", color: { rgb: "A7F3D0" } },
      right: { style: "thin", color: { rgb: "A7F3D0" } }
    }
  },
  negative: {
    font: { name: 'Cairo', sz: 9.5, bold: true, color: { rgb: "991B1B" } }, // Ruby Text
    fill: { fgColor: { rgb: "FEE2E2" } }, // Rose Background
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "FECACA" } },
      bottom: { style: "thin", color: { rgb: "FECACA" } },
      left: { style: "thin", color: { rgb: "FECACA" } },
      right: { style: "thin", color: { rgb: "FECACA" } }
    }
  },
  warning: {
    font: { name: 'Cairo', sz: 9.5, bold: true, color: { rgb: "92400E" } }, // Amber Text
    fill: { fgColor: { rgb: "FEF3C7" } }, // Amber Background
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "FDE68A" } },
      bottom: { style: "thin", color: { rgb: "FDE68A" } },
      left: { style: "thin", color: { rgb: "FDE68A" } },
      right: { style: "thin", color: { rgb: "FDE68A" } }
    }
  }
}

/**
 * Saves Excel Workbook by triggering the native Windows "Save As" file dialog
 */
export async function saveExcelWithDialog(wb: XLSX.WorkBook, defaultFileName: string): Promise<boolean> {
  const finalDefaultName = defaultFileName.endsWith('.xlsx') ? defaultFileName : `${defaultFileName}.xlsx`
  try {
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
    const savedPath = await invoke<string | null>('save_excel_file', {
      defaultName: finalDefaultName,
      base64Content: base64
    })

    return !!savedPath
  } catch (err) {
    console.error('Save dialog error, falling back to browser download:', err)
    XLSX.writeFile(wb, finalDefaultName)
    return true
  }
}

/**
 * Builds a beautifully formatted worksheet with title, subtitle, zebra striping, and auto RTL.
 */
function buildFormattedSheet(
  title: string,
  dateFrom: string,
  dateTo: string,
  headers: string[],
  dataRows: any[][],
  colWidths: { wch: number }[],
  summaryCardText?: string
) {
  const titleCell = { v: `📊 ${title}`, t: 's', s: styles.title }
  const subtitleCell = {
    v: summaryCardText || `الفترة من: ${dateFrom} إلى: ${dateTo}   |   تاريخ الاستخراج: ${today()}   |   نظام XPhone Store`,
    t: 's',
    s: styles.subtitle
  }

  const headerCells = headers.map(h => ({ v: h, t: 's', s: styles.header }))

  const formattedDataRows = dataRows.map((row, rowIdx) =>
    row.map(cellValue => {
      if (cellValue && typeof cellValue === 'object' && 'v' in cellValue) {
        return cellValue
      }
      const isNum = typeof cellValue === 'number'
      const baseStyle = rowIdx % 2 === 0 ? styles.dataEven : styles.dataOdd
      return {
        v: cellValue === null || cellValue === undefined ? '' : cellValue,
        t: isNum ? 'n' : 's',
        s: baseStyle
      }
    })
  )

  const aoa: any[][] = [
    [titleCell],
    [subtitleCell],
    [], // spacer
    headerCells,
    ...formattedDataRows
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!views'] = [{ RTL: true }]
  ws['!cols'] = colWidths

  // Merges
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 1) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(headers.length - 1, 1) } }
  ]

  // Set row heights
  ws['!rows'] = [
    { hpt: 32 }, // Title
    { hpt: 22 }, // Subtitle
    { hpt: 8 },  // Spacer
    { hpt: 26 }, // Header
  ]

  return ws
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FULL ACCOUNTING REPORT (تقرير المحاسبة والقوائم المالية الشامل)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportFullAccountingExcel(dateFrom: string, dateTo: string): Promise<boolean> {
  try {
    const [bsRes, plRes, expensesRes, detailedSalesRes] = await Promise.allSettled([
      invoke<any>('get_balance_sheet', { targetDate: dateTo, target_date: dateTo }),
      getProfitLoss(dateFrom, dateTo),
      getExpenses({ date_from: dateFrom, date_to: dateTo, dateFrom, dateTo }),
      invoke<any[]>('get_detailed_sale_items_report', { dateFrom, dateTo, date_from: dateFrom, date_to: dateTo }),
    ])

    const bs = bsRes.status === 'fulfilled' ? bsRes.value : {
      cash_and_banks: 0, accounts_receivable: 0, inventory_value: 0, total_current_assets: 0,
      fixed_assets_gross: 0, accumulated_depreciation: 0, fixed_assets_net: 0, total_assets: 0,
      accounts_payable: 0, accrued_expenses: 0, customer_advances: 0, total_liabilities: 0,
      capital: 0, short_term_contributions: 0, drawings: 0, retained_and_current_earnings: 0,
      total_equity: 0, is_balanced: true, discrepancy: 0
    }

    const pl = plRes.status === 'fulfilled' ? plRes.value : {
      sales_revenue: 0, repair_revenue: 0, monetary_revenue: 0, total_revenue: 0,
      cogs: 0, damaged_goods_cost: 0, repair_parts_cost: 0, gross_profit: 0,
      total_expenses: 0, net_profit: 0, expense_breakdown: []
    }

    const expenses = expensesRes.status === 'fulfilled' ? expensesRes.value : []
    const detailedSales = detailedSalesRes.status === 'fulfilled' ? detailedSalesRes.value : []

    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Balance Sheet ──
    const bsRows = [
      [{ v: "1. الأصول (Assets)", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }],
      [{ v: "  النقدية والبنوك والمحافظ", t: 's', s: styles.dataEven }, { v: bs.cash_and_banks, t: 'n', s: styles.dataEven }],
      [{ v: "  العملاء والمدينون (البيع الآجل)", t: 's', s: styles.dataEven }, { v: bs.accounts_receivable, t: 'n', s: styles.dataEven }],
      [{ v: "  المخزون السلعي بالتكلفة", t: 's', s: styles.dataEven }, { v: bs.inventory_value, t: 'n', s: styles.dataEven }],
      [{ v: "إجمالي الأصول المتداولة", t: 's', s: styles.boldData }, { v: bs.total_current_assets, t: 'n', s: styles.boldData }],
      [{ v: "  الأصول الثابتة الإجمالية", t: 's', s: styles.dataEven }, { v: bs.fixed_assets_gross, t: 'n', s: styles.dataEven }],
      [{ v: "  يطرح: مجمع الإهلاك", t: 's', s: styles.dataEven }, { v: -bs.accumulated_depreciation, t: 'n', s: styles.negative }],
      [{ v: "صافي الأصول الثابتة", t: 's', s: styles.boldData }, { v: bs.fixed_assets_net, t: 'n', s: styles.boldData }],
      [{ v: "إجمالي الأصول (Total Assets)", t: 's', s: styles.totalRow }, { v: bs.total_assets, t: 'n', s: styles.totalRow }],
      [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
      [{ v: "2. الالتزامات والخصوم (Liabilities)", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }],
      [{ v: "  الموردون والدائنون (مشتريات آجلة)", t: 's', s: styles.dataEven }, { v: bs.accounts_payable, t: 'n', s: styles.dataEven }],
      [{ v: "  مصروفات مستحقة واجبة السداد", t: 's', s: styles.dataEven }, { v: bs.accrued_expenses, t: 'n', s: styles.dataEven }],
      [{ v: "  دفعات مقدمة من العملاء", t: 's', s: styles.dataEven }, { v: bs.customer_advances, t: 'n', s: styles.dataEven }],
      [{ v: "إجمالي الالتزامات (Total Liabilities)", t: 's', s: styles.boldData }, { v: bs.total_liabilities, t: 'n', s: styles.boldData }],
      [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
      [{ v: "3. حقوق الملكية (Equity)", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }],
      [{ v: "  رأس المال الأساسي للشركاء", t: 's', s: styles.dataEven }, { v: bs.capital, t: 'n', s: styles.dataEven }],
      [{ v: "  المساهمات قصيرة الأجل", t: 's', s: styles.dataEven }, { v: bs.short_term_contributions, t: 'n', s: styles.dataEven }],
      [{ v: "  يطرح: مسحوبات الشركاء", t: 's', s: styles.dataEven }, { v: -bs.drawings, t: 'n', s: styles.negative }],
      [{ v: "  الأرباح المحتجزة / صافي أرباح الفترة", t: 's', s: styles.dataEven }, { v: bs.retained_and_current_earnings, t: 'n', s: bs.retained_and_current_earnings >= 0 ? styles.positive : styles.negative }],
      [{ v: "إجمالي حقوق الملكية (Total Equity)", t: 's', s: styles.boldData }, { v: bs.total_equity, t: 'n', s: styles.boldData }],
      [{ v: "إجمالي الالتزامات وحقوق الملكية", t: 's', s: styles.totalRow }, { v: bs.total_liabilities + bs.total_equity, t: 'n', s: styles.totalRow }],
      [{ v: "حالة اتزان الميزانية المحاسبية", t: 's', s: styles.boldData }, { v: bs.is_balanced ? "متزنة تماماً (Balanced)" : `فرق: ${formatEGP(bs.discrepancy)}`, t: 's', s: bs.is_balanced ? styles.positive : styles.negative }]
    ]

    const wsBS = buildFormattedSheet(
      "قائمة المركز المالي (الميزانية العمومية)",
      dateFrom,
      dateTo,
      ["البند المحاسبي", "المبلغ (ج.م)"],
      bsRows,
      [{ wch: 42 }, { wch: 24 }]
    )
    XLSX.utils.book_append_sheet(wb, wsBS, "الميزانية العمومية")

    // ── Sheet 2: P&L Summary ──
    const plRows = [
      [{ v: "1. الإيرادات التشغيلية", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }],
      [{ v: "  إيرادات مبيعات المنتجات", t: 's', s: styles.dataEven }, { v: pl.sales_revenue, t: 'n', s: styles.dataEven }],
      [{ v: "  إيرادات خدمات الصيانة", t: 's', s: styles.dataEven }, { v: pl.repair_revenue, t: 'n', s: styles.dataEven }],
      [{ v: "  عمولات الخدمات المالية والمحافظ", t: 's', s: styles.dataEven }, { v: pl.monetary_revenue, t: 'n', s: styles.dataEven }],
      [{ v: "إجمالي الإيرادات", t: 's', s: styles.boldData }, { v: pl.total_revenue, t: 'n', s: styles.boldData }],
      [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
      [{ v: "2. التكاليف المباشرة", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }],
      [{ v: "  تكلفة البضاعة المباعة (COGS)", t: 's', s: styles.dataEven }, { v: -pl.cogs, t: 'n', s: styles.negative }],
      [{ v: "  تكلفة الهالك / التالف", t: 's', s: styles.dataEven }, { v: -pl.damaged_goods_cost, t: 'n', s: styles.negative }],
      [{ v: "  تكلفة قطع غيار الصيانة", t: 's', s: styles.dataEven }, { v: -pl.repair_parts_cost, t: 'n', s: styles.negative }],
      [{ v: "مجمل الربح (Gross Profit)", t: 's', s: styles.totalRow }, { v: pl.gross_profit, t: 'n', s: styles.totalRow }],
      [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
      [{ v: "3. المصروفات التشغيلية", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }]
    ]

    pl.expense_breakdown.forEach((exp: any) => {
      plRows.push([
        { v: `  مصاريف: ${exp.category}`, t: 's', s: styles.dataEven },
        { v: -exp.amount, t: 'n', s: styles.dataEven }
      ])
    })

    plRows.push(
      [{ v: "إجمالي المصروفات", t: 's', s: styles.boldData }, { v: -pl.total_expenses, t: 'n', s: styles.negative }],
      [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
      [
        { v: "صافي الربح / الخسارة (Net Profit)", t: 's', s: styles.totalRow },
        { v: pl.net_profit, t: 'n', s: pl.net_profit >= 0 ? styles.positive : styles.negative }
      ]
    )

    const wsPL = buildFormattedSheet(
      "قائمة الأرباح والخسائر (قائمة الدخل)",
      dateFrom,
      dateTo,
      ["البند والبيان", "المبلغ (ج.م)"],
      plRows,
      [{ wch: 38 }, { wch: 22 }]
    )
    XLSX.utils.book_append_sheet(wb, wsPL, "الأرباح والخسائر")

    // ── Sheet 3: Sales Details ──
    const salesHeaders = [
      "رقم الفاتورة", "التاريخ والوقت", "العميل", "المنتج", "الماركة",
      "الكمية", "سعر البيع", "الخصم", "الإجمالي", "طريقة الدفع"
    ]
    const salesData = (detailedSales || []).map((s: any) => [
      s.invoice_no,
      formatDateTime(s.created_at),
      s.customer_name || 'نقدي',
      s.product_name,
      s.brand_name || '—',
      s.qty,
      s.unit_price,
      s.discount,
      s.line_total,
      s.payment_method === 'cash' ? 'نقدي' : s.payment_method === 'card' ? 'بطاقة/محفظة' : 'مختلط'
    ])
    const wsSales = buildFormattedSheet(
      "حركة المبيعات والأصناف المباعة التفصيلية",
      dateFrom,
      dateTo,
      salesHeaders,
      salesData,
      [
        { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 32 }, { wch: 16 },
        { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }
      ]
    )
    XLSX.utils.book_append_sheet(wb, wsSales, "تفاصيل المبيعات")

    // ── Sheet 4: Expenses ──
    const expHeaders = ["التاريخ", "البند / التصنيف", "المبلغ", "طريقة الدفع", "الملاحظات"]
    const expData = (expenses || []).map((e: any) => [
      formatDate(e.created_at),
      e.category_name,
      e.amount,
      e.payment_method === 'cash' ? 'نقدي' : 'بنك / محفظة',
      e.description || '—'
    ])
    const wsExp = buildFormattedSheet(
      "سجل المصروفات العامة والتشغيلية",
      dateFrom,
      dateTo,
      expHeaders,
      expData,
      [{ wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 38 }]
    )
    XLSX.utils.book_append_sheet(wb, wsExp, "المصروفات")

    wb.Workbook = { Views: [{ RTL: true }] }
    const defaultName = `تقرير_المحاسبة_والقوائم_المالية_من_${dateFrom}_إلى_${dateTo}_تاريخ_${today()}.xlsx`
    return await saveExcelWithDialog(wb, defaultName)
  } catch (err) {
    console.error("Excel Export Error:", err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PERIOD SALES REPORT WITH TOTALS (تقرير مبيعات الفترة متضمن الإجماليات)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPeriodSalesReport(dateFrom: string, dateTo: string): Promise<boolean> {
  const sales = await getSales({ date_from: dateFrom, date_to: dateTo })
  const wb = XLSX.utils.book_new()

  let totalGross = 0
  let totalDiscount = 0
  let totalNet = 0
  let totalCash = 0
  let totalCard = 0

  const headers = [
    "م", "رقم الفاتورة", "التاريخ والوقت", "اسم العميل", "المنتجات المباعة",
    "المجموع الفرعي", "الخصم", "صافي الفاتورة", "المدفوع نقداً", "المدفوع بطاقة/محفظة", "الحالة"
  ]

  const dataRows: any[][] = (sales || []).map((s: any, idx: number) => {
    const subtotal = s.subtotal || s.total
    const discount = s.discount || 0
    const net = s.total || 0
    const cash = s.cash_amount || 0
    const card = s.card_amount || 0

    totalGross += subtotal
    totalDiscount += discount
    totalNet += net
    totalCash += cash
    totalCard += card

    const itemsStr = s.items?.map((it: any) => `${it.product_name} (${it.qty}×)`).join(' • ') || '—'
    const isReturned = s.status === 'returned'
    const isPartial = s.status === 'partial_return'

    return [
      idx + 1,
      s.invoice_no,
      formatDateTime(s.created_at),
      s.customer_name || 'عميل نقدي',
      itemsStr,
      subtotal,
      discount,
      net,
      cash,
      card,
      {
        v: isReturned ? 'مرتجع كامل' : isPartial ? 'مرتجع جزئي' : 'مكتملة',
        t: 's',
        s: isReturned ? styles.negative : isPartial ? styles.warning : styles.positive
      }
    ]
  })

  // Add Grand Totals Row (صف الإجماليات الشامل)
  dataRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `عدد الفواتير: ${sales.length}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalGross, t: 'n', s: styles.totalRow },
    { v: totalDiscount, t: 'n', s: styles.totalRow },
    { v: totalNet, t: 'n', s: styles.totalRow },
    { v: totalCash, t: 'n', s: styles.totalRow },
    { v: totalCard, t: 'n', s: styles.totalRow },
    { v: "إجمالي الفترة", t: 's', s: styles.totalRow }
  ])

  const ws = buildFormattedSheet(
    "تقرير وفواتير المبيعات التفصيلي مع الإجماليات",
    dateFrom,
    dateTo,
    headers,
    dataRows,
    [
      { wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 45 },
      { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 15 }
    ]
  )

  XLSX.utils.book_append_sheet(wb, ws, "فواتير المبيعات")

  // Sheet 2: سجل البضاعة التالفة والهالك
  try {
    const damaged = await getDamagedGoods(dateFrom, dateTo)
    if (damaged && damaged.length > 0) {
      const dmgHeaders = [
        "م", "تاريخ الهالك", "اسم الصنف التالف", "الكمية التالفة", "سعر التكلفة", "إجمالي تكلفة الهالك (المصروف)", "سبب التلف والاستبعاد", "القائم بالعملية"
      ]
      let totalDmgQty = 0
      let totalDmgCost = 0
      const dmgRows = damaged.map((d: any, idx: number) => {
        totalDmgQty += d.qty
        totalDmgCost += d.total_cost
        return [
          idx + 1,
          formatDateTime(d.created_at),
          d.product_name,
          d.qty,
          d.unit_cost,
          d.total_cost,
          d.reason || 'هالك / تالف',
          d.user_name || 'المدير'
        ]
      })
      dmgRows.push([
        { v: "الإجمالي", t: 's', s: styles.totalRow },
        { v: `عدد العمليات: ${damaged.length}`, t: 's', s: styles.totalRow },
        { v: "—", t: 's', s: styles.totalRow },
        { v: totalDmgQty, t: 'n', s: styles.totalRow },
        { v: "—", t: 's', s: styles.totalRow },
        { v: totalDmgCost, t: 'n', s: styles.totalRow },
        { v: "إجمالي خسائر الهالك", t: 's', s: styles.totalRow },
        { v: "—", t: 's', s: styles.totalRow }
      ])
      const wsDmg = buildFormattedSheet(
        "سجل البضاعة التالفة والهالك خلال الفترة المحاسبية",
        dateFrom,
        dateTo,
        dmgHeaders,
        dmgRows,
        [{ wch: 6 }, { wch: 22 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 35 }, { wch: 22 }],
        `بيان الأصناف المستبعدة وتكلفتها المحملة على المصروفات واسم المستخدم القائم بالعملية`
      )
      XLSX.utils.book_append_sheet(wb, wsDmg, "البضاعة التالفة والهالك")
    }
  } catch (e) {
    console.error(e)
  }

  wb.Workbook = { Views: [{ RTL: true }] }

  const defaultName = `تقرير_المبيعات_التفصيلي_عن_الفترة_من_${dateFrom}_إلى_${dateTo}_تاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PERIOD MONETARY SERVICES REPORT (تقرير الخدمات المالية والمحافظ مع الإجماليات)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPeriodMonetaryReport(dateFrom: string, dateTo: string): Promise<boolean> {
  const txs = await getMonetaryTransactions({ date_from: dateFrom, date_to: dateTo })
  const wb = XLSX.utils.book_new()

  let totalIn = 0
  let totalOut = 0
  let totalCommission = 0
  let totalNetProfit = 0

  const headers = [
    "م", "التاريخ والوقت", "نوع الخدمة", "نوع العملية", "اسم العميل",
    "المبلغ (ج.م)", "العمولة المحصلة", "صافي الربح", "الحساب المالي المربوط", "ملاحظات"
  ]

  const dataRows: any[][] = (txs || []).map((tx: any, idx: number) => {
    const isCashIn = tx.tx_type === 'cash_in' || tx.tx_type === 'transfer_in'
    const isCashOut = tx.tx_type === 'cash_out' || tx.tx_type === 'transfer_out'

    if (isCashIn) totalIn += tx.amount || 0
    else if (isCashOut) totalOut += tx.amount || 0

    totalCommission += tx.commission || 0
    totalNetProfit += tx.net_profit || tx.commission || 0

    const txTypeLabel =
      tx.tx_type === 'cash_in' ? 'إيداع / شحن' :
      tx.tx_type === 'cash_out' ? 'سحب نقدي' :
      tx.tx_type === 'transfer_in' ? 'استلام تحويل' :
      tx.tx_type === 'transfer_out' ? 'إرسال تحويل' : 'دفع فواتير'

    return [
      idx + 1,
      formatDateTime(tx.created_at),
      tx.service_name,
      {
        v: txTypeLabel,
        t: 's',
        s: isCashIn ? styles.positive : isCashOut ? styles.warning : styles.dataEven
      },
      tx.customer_name || 'عميل نقدي',
      tx.amount,
      tx.commission,
      { v: tx.net_profit || tx.commission, t: 'n', s: styles.positive },
      tx.financial_account_name || '—',
      tx.notes || '—'
    ]
  })

  // Grand Totals Row
  dataRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `عدد العمليات: ${txs.length}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: `إيداع: ${formatEGP(totalIn)} | سحب: ${formatEGP(totalOut)}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalIn + totalOut, t: 'n', s: styles.totalRow },
    { v: totalCommission, t: 'n', s: styles.totalRow },
    { v: totalNetProfit, t: 'n', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "إجمالي أرباح الخدمات", t: 's', s: styles.totalRow }
  ])

  const ws = buildFormattedSheet(
    "تقرير حركة الخدمات المالية والمحافظ الإلكترونية مع الإجماليات",
    dateFrom,
    dateTo,
    headers,
    dataRows,
    [
      { wch: 6 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 30 }
    ]
  )

  XLSX.utils.book_append_sheet(wb, ws, "الخدمات المالية")
  wb.Workbook = { Views: [{ RTL: true }] }

  const defaultName = `تقرير_الخدمات_المالية_والمحافظ_عن_الفترة_من_${dateFrom}_إلى_${dateTo}_تاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PERIOD REPAIRS REPORT (تقرير عمليات وخدمات الصيانة مع الإجماليات)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPeriodRepairsReport(dateFrom: string, dateTo: string): Promise<boolean> {
  const jobs = await getRepairJobs({ date_from: dateFrom, date_to: dateTo })
  const wb = XLSX.utils.book_new()

  let totalLabor = 0
  let totalParts = 0
  let totalCostToCustomer = 0
  let totalPaid = 0
  let totalRepairProfit = 0

  const headers = [
    "م", "رقم الإيصال", "تاريخ الاستلام", "اسم العميل", "الهاتف",
    "الجهاز والماركة", "المشكلة / العطل", "الحالة",
    "تكلفة قطع الغيار", "أجرة اليد / المصنعية", "إجمالي التكلفة", "المدفوع", "صافي ربح الصيانة"
  ]

  const dataRows: any[][] = (jobs || []).map((j: any, idx: number) => {
    const labor = j.labor_cost || 0
    const parts = j.parts_cost || 0
    const total = j.total_cost || (labor + parts)
    const paid = j.amount_paid || 0
    const profit = labor // Labor is pure service profit

    totalLabor += labor
    totalParts += parts
    totalCostToCustomer += total
    totalPaid += paid
    totalRepairProfit += profit

    const statusObj =
      j.status === 'delivered' ? { text: 'تم التسليم', style: styles.positive } :
      j.status === 'repaired' ? { text: 'تم الإصلاح', style: styles.positive } :
      j.status === 'in_progress' ? { text: 'جاري العمل', style: styles.warning } :
      j.status === 'cancelled' ? { text: 'ملغى / مرتجع', style: styles.negative } :
      { text: 'قيد الانتظار', style: styles.dataEven }

    return [
      idx + 1,
      j.job_no,
      formatDate(j.received_at),
      j.customer_name,
      j.customer_phone || '—',
      `${j.device_brand_name || ''} ${j.device_model || ''}`.trim() || '—',
      j.fault_desc || '—',
      { v: statusObj.text, t: 's', s: statusObj.style },
      parts,
      labor,
      total,
      paid,
      { v: profit, t: 'n', s: styles.positive }
    ]
  })

  // Grand Totals Row
  dataRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `عدد الأجهزة: ${jobs.length}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalParts, t: 'n', s: styles.totalRow },
    { v: totalLabor, t: 'n', s: styles.totalRow },
    { v: totalCostToCustomer, t: 'n', s: styles.totalRow },
    { v: totalPaid, t: 'n', s: styles.totalRow },
    { v: totalRepairProfit, t: 'n', s: styles.totalRow }
  ])

  const ws = buildFormattedSheet(
    "تقرير خدمات وعمليات الصيانة مع الإجماليات",
    dateFrom,
    dateTo,
    headers,
    dataRows,
    [
      { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 16 },
      { wch: 24 }, { wch: 28 }, { wch: 16 },
      { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }
    ]
  )

  XLSX.utils.book_append_sheet(wb, ws, "تقرير الصيانة")
  wb.Workbook = { Views: [{ RTL: true }] }

  const defaultName = `تقرير_عمليات_الصيانة_عن_الفترة_من_${dateFrom}_إلى_${dateTo}_تاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.5. PERIOD PURCHASES & INVOICES REPORT (تقرير فواتير المشتريات والموردين مع الإجماليات)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPeriodPurchasesReport(dateFrom: string, dateTo: string): Promise<boolean> {
  const orders = await getPurchaseOrders({ date_from: dateFrom, date_to: dateTo })
  const wb = XLSX.utils.book_new()

  let totalCostSum = 0
  let totalPaidSum = 0
  let totalDebtSum = 0

  const headers = [
    "م", "رقم الفاتورة", "التاريخ والوقت", "اسم المورد", "الأصناف المشتراة",
    "إجمالي الفاتورة", "المدفوع نقداً/بنك", "المتبقي (آجل)", "طريقة السداد / الحساب", "ملاحظات"
  ]

  const dataRows: any[][] = (orders || []).map((po: any, idx: number) => {
    const total = po.total_cost || 0
    const paid = po.amount_paid || 0
    const debt = Math.max(0, total - paid)

    totalCostSum += total
    totalPaidSum += paid
    totalDebtSum += debt

    const itemsStr = po.items?.map((it: any) => `${it.product_name} (${it.qty_received || it.qty_ordered}×)`).join(' • ') || '—'

    return [
      idx + 1,
      po.invoice_no || po.id?.slice(0, 8) || '—',
      formatDateTime(po.created_at || po.ordered_at),
      po.supplier_name,
      itemsStr,
      total,
      paid,
      { v: debt, t: 'n', s: debt > 0 ? styles.negative : styles.dataEven },
      po.financial_account_name || 'نقدي (الخزينة)',
      po.notes || '—'
    ]
  })

  // Grand Totals Row
  dataRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `عدد الفواتير: ${orders.length}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalCostSum, t: 'n', s: styles.totalRow },
    { v: totalPaidSum, t: 'n', s: styles.totalRow },
    { v: totalDebtSum, t: 'n', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "إجمالي مشتريات الفترة", t: 's', s: styles.totalRow }
  ])

  const ws = buildFormattedSheet(
    "تقرير فواتير المشتريات وتوريدات الموردين مع الإجماليات",
    dateFrom,
    dateTo,
    headers,
    dataRows,
    [
      { wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 24 }, { wch: 45 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 30 }
    ]
  )

  XLSX.utils.book_append_sheet(wb, ws, "فواتير المشتريات")
  wb.Workbook = { Views: [{ RTL: true }] }

  const defaultName = `تقرير_المشتريات_وفواتير_الموردين_عن_الفترة_من_${dateFrom}_إلى_${dateTo}_تاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INVENTORY PRODUCTS REPORT (تقرير المخزون والأصناف مع الإجماليات)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportInventoryExcel(products: any[], brands: any[], categories: any[]): Promise<boolean> {
  const wb = XLSX.utils.book_new()
  const headers = [
    "م", "كود SKU", "اسم المنتج بالعربية", "اسم المنتج بالإنجليزية", "الماركة", "الفئة",
    "اللون", "السعة", "الرام", "سعر التكلفة", "سعر البيع", "الكمية بالمخزن", "حد الطلب",
    "إجمالي قيمة التكلفة", "إجمالي قيمة البيع المتوقعة", "الربح المتوقع"
  ]

  const brandMap = new Map(brands.map((b: any) => [b.id, b.name]))
  const catMap = new Map(categories.map((c: any) => [c.id, c.name_ar]))

  let totalQty = 0
  let totalCostVal = 0
  let totalSellVal = 0

  const dataRows: any[][] = (products || []).map((p: any, idx: number) => {
    const qty = p.stock_qty || 0
    const cost = p.cost_price || 0
    const sell = p.sell_price || 0
    const lineCost = qty * cost
    const lineSell = qty * sell
    const profit = lineSell - lineCost

    totalQty += qty
    totalCostVal += lineCost
    totalSellVal += lineSell

    return [
      idx + 1,
      p.sku || '—',
      p.name_ar,
      p.name_en || '—',
      brandMap.get(p.brand_id) || '—',
      catMap.get(p.category_id) || '—',
      p.variant_color || '—',
      p.variant_storage || '—',
      p.variant_ram || '—',
      cost,
      sell,
      { v: qty, t: 'n', s: qty <= (p.reorder_level || 5) ? styles.warning : styles.dataEven },
      p.reorder_level || 5,
      lineCost,
      lineSell,
      { v: profit, t: 'n', s: profit >= 0 ? styles.positive : styles.negative }
    ]
  })

  // Grand Totals Row
  dataRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `عدد الأصناف: ${products.length}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalQty, t: 'n', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalCostVal, t: 'n', s: styles.totalRow },
    { v: totalSellVal, t: 'n', s: styles.totalRow },
    { v: totalSellVal - totalCostVal, t: 'n', s: styles.totalRow }
  ])

  const ws = buildFormattedSheet(
    "تقرير جرد وتقييم المخزون السلعي مع الإجماليات",
    today(),
    today(),
    headers,
    dataRows,
    [
      { wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 },
      { wch: 20 }, { wch: 22 }, { wch: 18 }
    ]
  )

  XLSX.utils.book_append_sheet(wb, ws, "المخزون السلعي")

  // Sheet 2: سجل البضاعة التالفة والهالك
  try {
    const damaged = await getDamagedGoods()
    if (damaged && damaged.length > 0) {
      const dmgHeaders = [
        "م", "تاريخ الهالك", "اسم الصنف التالف", "الكمية التالفة", "سعر التكلفة", "إجمالي تكلفة الهالك (المصروف)", "سبب التلف والاستبعاد", "القائم بالعملية"
      ]
      let totalDmgQty = 0
      let totalDmgCost = 0
      const dmgRows = damaged.map((d: any, idx: number) => {
        totalDmgQty += d.qty
        totalDmgCost += d.total_cost
        return [
          idx + 1,
          formatDateTime(d.created_at),
          d.product_name,
          d.qty,
          d.unit_cost,
          d.total_cost,
          d.reason || 'هالك / تالف',
          d.user_name || 'المدير'
        ]
      })
      dmgRows.push([
        { v: "الإجمالي", t: 's', s: styles.totalRow },
        { v: `عدد العمليات: ${damaged.length}`, t: 's', s: styles.totalRow },
        { v: "—", t: 's', s: styles.totalRow },
        { v: totalDmgQty, t: 'n', s: styles.totalRow },
        { v: "—", t: 's', s: styles.totalRow },
        { v: totalDmgCost, t: 'n', s: styles.totalRow },
        { v: "إجمالي خسائر الهالك", t: 's', s: styles.totalRow },
        { v: "—", t: 's', s: styles.totalRow }
      ])
      const wsDmg = buildFormattedSheet(
        "سجل البضاعة التالفة والهالك المستبعدة من المخزون",
        today(),
        today(),
        dmgHeaders,
        dmgRows,
        [{ wch: 6 }, { wch: 22 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 35 }, { wch: 22 }],
        `بيان كافة الأصناف المستبعدة وتكلفتها المحملة على المصروفات واسم المستخدم القائم بالعملية`
      )
      XLSX.utils.book_append_sheet(wb, wsDmg, "البضاعة التالفة والهالك")
    }
  } catch (e) {
    console.error(e)
  }

  wb.Workbook = { Views: [{ RTL: true }] }

  const defaultName = `تقرير_المخزون_والأصناف_في_تاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CASH & LIQUIDITY AUDIT REPORT (تقرير جرد ومطابقة السيولة)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportCashAuditExcel(audit: any): Promise<boolean> {
  const wb = XLSX.utils.book_new()
  const headers = [
    "م", "الحساب المالي / الخزينة", "الرصيد الدفتري المسجل", "الرصيد الفعلي المجرود", "الفارق (عجز / زيادة)", "حالة المطابقة", "ملاحظات"
  ]

  let totalSystem = 0
  let totalActual = 0
  let totalVariance = 0

  const dataRows: any[][] = (audit.items || []).map((it: any, idx: number) => {
    const isZero = Math.abs(it.variance || 0) < 0.01
    const isShortage = it.variance < -0.01

    totalSystem += it.system_balance || 0
    totalActual += it.actual_balance || 0
    totalVariance += it.variance || 0

    return [
      idx + 1,
      it.account_name,
      it.system_balance,
      it.actual_balance,
      {
        v: it.variance,
        t: 'n',
        s: isZero ? styles.dataEven : isShortage ? styles.negative : styles.positive
      },
      {
        v: isZero ? 'متطابق تماماً' : isShortage ? 'عجز نقدي' : 'فائض نقدي',
        t: 's',
        s: isZero ? styles.positive : isShortage ? styles.negative : styles.warning
      },
      it.notes || '—'
    ]
  })

  // Grand Totals Row
  dataRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: "إجمالي الخزن والحسابات", t: 's', s: styles.totalRow },
    { v: totalSystem, t: 'n', s: styles.totalRow },
    { v: totalActual, t: 'n', s: styles.totalRow },
    { v: totalVariance, t: 'n', s: styles.totalRow },
    {
      v: Math.abs(totalVariance) < 0.01 ? "مطابقة تامة" : (totalVariance < 0 ? "صافي عجز" : "صافي زيادة"),
      t: 's',
      s: styles.totalRow
    },
    { v: "—", t: 's', s: styles.totalRow }
  ])

  const ws = buildFormattedSheet(
    `تقرير جرد ومطابقة السيولة النقدية والخزن - ${audit.title || today()}`,
    formatDate(audit.audit_date || today()),
    formatDate(audit.audit_date || today()),
    headers,
    dataRows,
    [
      { wch: 6 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 30 }
    ]
  )

  XLSX.utils.book_append_sheet(wb, ws, "مطابقة السيولة")
  wb.Workbook = { Views: [{ RTL: true }] }

  const defaultName = `تقرير_جرد_ومطابقة_السيولة_والخزينة_بتاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PERIOD REVENUE & EXPENSES SUMMARY REPORT (تقرير إجمالي الإيرادات والمصروفات)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPeriodRevenueExpenseReport(dateFrom: string, dateTo: string): Promise<boolean> {
  const [pl, expenses, sales, repairs, monetary] = await Promise.all([
    getProfitLoss(dateFrom, dateTo),
    getExpenses({ date_from: dateFrom, date_to: dateTo }),
    getSales({ date_from: dateFrom, date_to: dateTo }),
    getRepairJobs({ date_from: dateFrom, date_to: dateTo }),
    getMonetaryTransactions({ date_from: dateFrom, date_to: dateTo })
  ])

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Summary Statement (ملخص الإيرادات والمصروفات والأرباح) ──
  const summaryRows = [
    [{ v: "1. الإيرادات المحققة للفترة", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }],
    [{ v: "  إيرادات مبيعات المنتجات", t: 's', s: styles.dataEven }, { v: `عدد الفواتير: ${sales.length}`, t: 's', s: styles.dataEven }, { v: pl.sales_revenue, t: 'n', s: styles.dataEven }],
    [{ v: "  إيرادات خدمات الصيانة", t: 's', s: styles.dataEven }, { v: `عدد الأجهزة: ${repairs.length}`, t: 's', s: styles.dataEven }, { v: pl.repair_revenue, t: 'n', s: styles.dataEven }],
    [{ v: "  عمولات وأرباح الخدمات المالية", t: 's', s: styles.dataEven }, { v: `عدد العمليات: ${monetary.length}`, t: 's', s: styles.dataEven }, { v: pl.monetary_revenue, t: 'n', s: styles.dataEven }],
    [{ v: "إجمالي الإيرادات الكلية", t: 's', s: styles.boldData }, { v: "—", t: 's', s: styles.boldData }, { v: pl.total_revenue, t: 'n', s: styles.boldData }],
    [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
    [{ v: "2. التكاليف المباشرة للبضاعة", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }],
    [{ v: "  تكلفة المبيعات (COGS)", t: 's', s: styles.dataEven }, { v: "تكلفة شراء البضاعة المباعة", t: 's', s: styles.dataEven }, { v: -pl.cogs, t: 'n', s: styles.negative }],
    [{ v: "  تكلفة البضاعة التالفة / الهالك", t: 's', s: styles.dataEven }, { v: "هالك وتالف المخزن", t: 's', s: styles.dataEven }, { v: -pl.damaged_goods_cost, t: 'n', s: styles.negative }],
    [{ v: "  تكلفة قطع غيار الصيانة", t: 's', s: styles.dataEven }, { v: "قطع تم استهلاكها بالصيانة", t: 's', s: styles.dataEven }, { v: -pl.repair_parts_cost, t: 'n', s: styles.negative }],
    [{ v: "مجمل الربح التجاري (Gross Profit)", t: 's', s: styles.totalRow }, { v: "—", t: 's', s: styles.totalRow }, { v: pl.gross_profit, t: 'n', s: styles.totalRow }],
    [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
    [{ v: "3. المصروفات التشغيلية والعمومية", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }, { v: "", t: 's', s: styles.boldData }]
  ]

  pl.expense_breakdown.forEach((exp: any) => {
    summaryRows.push([
      { v: `  مصاريف: ${exp.category}`, t: 's', s: styles.dataEven },
      { v: "بند مصروفات", t: 's', s: styles.dataEven },
      { v: -exp.amount, t: 'n', s: styles.dataEven }
    ])
  })

  summaryRows.push(
    [{ v: "إجمالي المصروفات التشغيلية", t: 's', s: styles.boldData }, { v: `عدد المصروفات: ${expenses.length}`, t: 's', s: styles.boldData }, { v: -pl.total_expenses, t: 'n', s: styles.negative }],
    [{ v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }, { v: "", t: 's', s: styles.dataEven }],
    [
      { v: "صافي أرباح / خسائر الفترة (Net Profit)", t: 's', s: styles.totalRow },
      { v: pl.net_profit >= 0 ? "صافي أرباح تشغيلية" : "صافي خسارة تشغيلية", t: 's', s: styles.totalRow },
      { v: pl.net_profit, t: 'n', s: pl.net_profit >= 0 ? styles.positive : styles.negative }
    ]
  )

  const wsSummary = buildFormattedSheet(
    "تقرير ملخص إجمالي الإيرادات والمصروفات وصافي أرباح الفترة",
    dateFrom,
    dateTo,
    ["البند والبيان", "التفاصيل والبيان الإحصائي", "المبلغ الإجمالي (ج.م)"],
    summaryRows,
    [{ wch: 38 }, { wch: 30 }, { wch: 24 }]
  )
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص الإيرادات والمصروفات")

  // ── Sheet 2: Expenses Log (سجل المصروفات بالتفصيل) ──
  const expHeaders = ["م", "التاريخ", "البند / التصنيف", "المبلغ (ج.م)", "طريقة الدفع / الخزينة", "البيان والملاحظات"]
  let totalExp = 0
  const expData = (expenses || []).map((e: any, idx: number) => {
    totalExp += e.amount || 0
    return [
      idx + 1,
      formatDate(e.created_at),
      e.category_name,
      e.amount,
      e.payment_method === 'cash' ? 'نقدي (الخزينة)' : 'بنك / محفظة',
      e.description || '—'
    ]
  })
  expData.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `عدد البنود: ${expenses.length}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalExp, t: 'n', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "إجمالي المصروفات", t: 's', s: styles.totalRow }
  ])
  const wsExp = buildFormattedSheet(
    "سجل تفاصيل المصروفات التشغيلية للفترة",
    dateFrom,
    dateTo,
    expHeaders,
    expData,
    [{ wch: 6 }, { wch: 16 }, { wch: 25 }, { wch: 18 }, { wch: 22 }, { wch: 38 }]
  )
  XLSX.utils.book_append_sheet(wb, wsExp, "تفاصيل المصروفات")

  wb.Workbook = { Views: [{ RTL: true }] }
  const defaultName = `تقرير_إجمالي_الإيرادات_والمصروفات_عن_الفترة_من_${dateFrom}_إلى_${dateTo}_تاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. CASH MOVEMENTS & RUNNING BALANCE REPORT (تقرير حركة النقدية والأرصدة والحدود)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 8. CASH MOVEMENTS & RUNNING BALANCE REPORT (تقرير حركة النقدية والأرصدة والحدود)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPeriodCashMovementsExcel(dateFrom: string, dateTo: string, accountId?: string): Promise<boolean> {
  let rep: any = null
  try {
    rep = await getCashMovementsReport({ dateFrom, dateTo, accountId })
  } catch (err) {
    console.error('Failed to get cash movements report:', err)
  }

  if (!rep) {
    rep = { movements: [], accounts: [], total_inflow: 0, total_outflow: 0, total_commission: 0, net_cashflow: 0 }
  }

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: الصفحة الرئيسية (كافة الحركات والإجماليات وسجل السيولة الشامل) ──
  const masterHeaders = [
    "م",
    "التاريخ والوقت",
    "الحساب النقدي / المالي",
    "نوع الحركة",
    "البيان والتفاصيل والمعاملة",
    "المبلغ الوارد (+)",
    "المبلغ الصادر (-)",
    "العمولة / الأرباح",
    "الرصيد بعد الحركة (ج.م)",
    "الحد المتبقي من السقف"
  ]

  const movements = rep.movements || []
  const masterRows = movements.map((m: any, idx: number) => [
    idx + 1,
    formatDateTime(m.date),
    m.account_name || 'حساب نقدي',
    m.tx_type || 'معاملة مالية',
    m.description || '—',
    m.inflow > 0 ? m.inflow : 0,
    m.outflow > 0 ? m.outflow : 0,
    m.commission > 0 ? m.commission : 0,
    m.balance_after,
    m.remaining_limit != null ? m.remaining_limit : "غير محدد"
  ])

  // Summary statistics row
  masterRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `الفترة: ${dateFrom} إلى ${dateTo}`, t: 's', s: styles.totalRow },
    { v: `عدد الحركات: ${movements.length}`, t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: `صافي التدفق: ${formatEGP(rep.net_cashflow || 0)}`, t: 's', s: styles.totalRow },
    { v: rep.total_inflow || 0, t: 'n', s: styles.positive },
    { v: rep.total_outflow || 0, t: 'n', s: styles.negative },
    { v: rep.total_commission || 0, t: 'n', s: styles.totalRow },
    { v: rep.net_cashflow || 0, t: 'n', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow }
  ])

  const wsMaster = buildFormattedSheet(
    `الصفحة الرئيسية - كشف الحركات والسيولة النقدية الشاملة`,
    dateFrom,
    dateTo,
    masterHeaders,
    masterRows,
    [
      { wch: 6 },
      { wch: 20 },
      { wch: 24 },
      { wch: 24 },
      { wch: 38 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 24 }
    ],
    `سجل كافة الحركات والتدفقات النقدية والعمولات لجميع الحسابات المالية للفترة من ${dateFrom} إلى ${dateTo}`
  )
  XLSX.utils.book_append_sheet(wb, wsMaster, "الصفحة الرئيسية - كشف الحركات")

  // ── Sheet 2: ملخص أ رصدة الحسابات المالية وسقف الحدود ──
  const accHeaders = [
    "م",
    "اسم الحساب المالي",
    "الرصيد الحالي النهائي (ج.م)",
    "الحد الأدنى للرصيد",
    "الحد الأقصى المسموح",
    "الحد / السقف المتبقي",
    "إجمالي وارد الفترة (+)",
    "إجمالي صادر الفترة (-)",
    "حالة الأمان والحدود"
  ]

  const accounts = rep.accounts || []
  const accRows = accounts.map((a: any, idx: number) => {
    const minLim = a.min_balance_limit != null ? a.min_balance_limit : "—"
    const maxLim = a.max_balance_limit != null ? a.max_balance_limit : "—"
    const remLim = a.max_balance_limit != null ? Math.max(0, a.max_balance_limit - a.balance) : "مفتوح"
    const statusText = a.alert_status === 'below_min' ? '⚠️ تحت الحد الأدنى' :
                       a.alert_status === 'near_min' ? '⚠️ يقترب من الأدنى' :
                       a.alert_status === 'above_max' ? '⚠️ تجاوز الحد الأقصى' :
                       a.alert_status === 'near_max' ? '⚠️ يقترب من الأقصى' : '✅ آمن ومستقر'
    return [
      idx + 1,
      a.name_ar,
      a.balance,
      minLim,
      maxLim,
      remLim,
      a.monthly_inflow || 0,
      a.monthly_outflow || 0,
      statusText
    ]
  })

  const totalAccBalance = accounts.reduce((s: number, a: any) => s + (a.balance || 0), 0)
  const totalMonthlyIn = accounts.reduce((s: number, a: any) => s + (a.monthly_inflow || 0), 0)
  const totalMonthlyOut = accounts.reduce((s: number, a: any) => s + (a.monthly_outflow || 0), 0)

  accRows.push([
    { v: "الإجمالي", t: 's', s: styles.totalRow },
    { v: `إجمالي الحسابات (${accounts.length})`, t: 's', s: styles.totalRow },
    { v: totalAccBalance, t: 'n', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: "—", t: 's', s: styles.totalRow },
    { v: totalMonthlyIn, t: 'n', s: styles.positive },
    { v: totalMonthlyOut, t: 'n', s: styles.negative },
    { v: "السيولة الكلية", t: 's', s: styles.totalRow }
  ])

  const wsAccSummary = buildFormattedSheet(
    "ملخص أرصدة الحسابات المالية وسقف الحدود",
    dateFrom,
    dateTo,
    accHeaders,
    accRows,
    [
      { wch: 6 },
      { wch: 25 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 }
    ],
    `موقف الأرصدة الإجمالية والسيولة المتاحة والحدود حتى تاريخ ${today()}`
  )
  XLSX.utils.book_append_sheet(wb, wsAccSummary, "ملخص الأرصدة والحدود")

  // ── Sub-sheets: صفحات أكسيل فرعية مخصصة لكل حساب مالي على حدة ──
  accounts.forEach((acc: any) => {
    // Filter movements belonging specifically to this account
    const accMovements = movements.filter((m: any) => m.account_id === acc.id || m.account_name === acc.name_ar)
    
    // Clean sheet name (Excel restricts sheet names to <= 31 chars and no special chars)
    let sheetName = acc.name_ar.replace(/[:\\/?*\[\]]/g, '').trim()
    if (sheetName.length > 28) sheetName = sheetName.slice(0, 28)
    if (!sheetName) sheetName = `حساب_${acc.id}`

    const accHeadersSub = [
      "م",
      "التاريخ والوقت",
      "نوع الحركة",
      "البيان والتفاصيل",
      "وارد (+)",
      "صادر (-)",
      "العمولة / الأرباح",
      "الرصيد بعد الحركة (ج.م)"
    ]

    let accInflow = 0
    let accOutflow = 0
    let accComm = 0

    const accDataSub = accMovements.map((m: any, idx: number) => {
      accInflow += m.inflow || 0
      accOutflow += m.outflow || 0
      accComm += m.commission || 0
      return [
        idx + 1,
        formatDateTime(m.date),
        m.tx_type || 'معاملة',
        m.description || '—',
        m.inflow > 0 ? m.inflow : 0,
        m.outflow > 0 ? m.outflow : 0,
        m.commission > 0 ? m.commission : 0,
        m.balance_after
      ]
    })

    accDataSub.push([
      { v: "إجمالي الحساب", t: 's', s: styles.totalRow },
      { v: `الرصيد الحالي: ${formatEGP(acc.balance)}`, t: 's', s: styles.totalRow },
      { v: `عدد الحركات: ${accMovements.length}`, t: 's', s: styles.totalRow },
      { v: "—", t: 's', s: styles.totalRow },
      { v: accInflow, t: 'n', s: styles.positive },
      { v: accOutflow, t: 'n', s: styles.negative },
      { v: accComm, t: 'n', s: styles.totalRow },
      { v: acc.balance, t: 'n', s: styles.totalRow }
    ])

    const wsAccSub = buildFormattedSheet(
      `كشف حركات وتدفقات حساب: ${acc.name_ar}`,
      dateFrom,
      dateTo,
      accHeadersSub,
      accDataSub,
      [
        { wch: 6 },
        { wch: 20 },
        { wch: 22 },
        { wch: 38 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 }
      ],
      `تفاصيل حركات حساب ${acc.name_ar} (الرصيد الحالي: ${formatEGP(acc.balance)}) عن الفترة من ${dateFrom} إلى ${dateTo}`
    )

    // Ensure unique sheet names
    let finalSheetName = sheetName
    let counter = 1
    while (wb.SheetNames.includes(finalSheetName)) {
      finalSheetName = `${sheetName}_${counter}`
      counter++
    }
    XLSX.utils.book_append_sheet(wb, wsAccSub, finalSheetName)
  })

  wb.Workbook = { Views: [{ RTL: true }] }
  const defaultName = `تقرير_كشف_حركات_الحسابات_والسيولة_والصفحات_الفرعية_من_${dateFrom}_إلى_${dateTo}_تاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. PRODUCT IMPORT TEMPLATE (قالب استيراد المنتجات)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadProductImportTemplate(): Promise<boolean> {
  const wb = XLSX.utils.book_new()
  const templateRows = [
    {
      "اسم المنتج بالعربية *": "سامسونج جالاكسي S24 الترا",
      "اسم المنتج بالإنجليزية": "Samsung Galaxy S24 Ultra",
      "كود المنتج SKU": "S24U-256-GRY",
      "الماركة": "Samsung",
      "الفئة *": "هواتف جديدة",
      "اللون": "تيتانيوم رمادي",
      "السعة": "256GB",
      "الرام": "12GB",
      "سعر التكلفة": 52000,
      "سعر البيع": 56000,
      "الكمية": 10,
      "حد الطلب": 2,
      "ملاحظات": "مثال توضيحي لمنتج جديد، يرجى حذف هذا السطر وإدخال منتجاتك"
    }
  ]
  const ws = XLSX.utils.json_to_sheet(templateRows)
  XLSX.utils.book_append_sheet(wb, ws, "قالب الاستيراد")
  wb.Workbook = { Views: [{ RTL: true }] }

  const defaultName = `قالب_استيراد_المنتجات_XPhone_بتاريخ_${today()}.xlsx`
  return await saveExcelWithDialog(wb, defaultName)
}

export async function importProductsFromExcel(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        if (!data) throw new Error("ملف فارغ")
        
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet) as any[]

        // Fetch brands and categories for mapping
        const brands = await invoke<any[]>('get_brands')
        const categories = await invoke<any[]>('get_categories')

        let successCount = 0

        for (const row of rows) {
          const nameAr = row["اسم المنتج بالعربية *"]
          const categoryName = row["الفئة *"]
          
          if (!nameAr || !categoryName) continue

          let brandId: number | null = null
          const brandName = row["الماركة"]
          if (brandName) {
            const matchedBrand = brands.find(
              b => b.name.toLowerCase() === brandName.toString().toLowerCase()
            )
            if (matchedBrand) brandId = matchedBrand.id
          }

          let categoryId = 1
          const matchedCategory = categories.find(
            c => c.name_ar === categoryName.toString().trim()
          )
          if (matchedCategory) categoryId = matchedCategory.id

          const payload = {
            sku: row["كود المنتج SKU"] ? row["كود المنتج SKU"].toString() : null,
            name_ar: nameAr.toString(),
            name_en: row["اسم المنتج بالإنجليزية"] ? row["اسم المنتج بالإنجليزية"].toString() : null,
            brand_id: brandId,
            category_id: categoryId,
            variant_color: row["اللون"] ? row["اللون"].toString() : null,
            variant_storage: row["السعة"] ? row["السعة"].toString() : null,
            variant_ram: row["الرام"] ? row["الرام"].toString() : null,
            cost_price: parseFloat(row["سعر التكلفة"]) || 0,
            sell_price: parseFloat(row["سعر البيع"]) || 0,
            stock_qty: parseInt(row["الكمية"]) || 0,
            reorder_level: parseInt(row["حد الطلب"]) || 5,
            notes: row["ملاحظات"] ? row["ملاحظات"].toString() : null,
          }

          await invoke('create_product', { payload })
          successCount++
        }
        resolve(successCount)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = (err) => reject(err)
    reader.readAsBinaryString(file)
  })
}

export async function exportShareholderLedgerExcel(
  ledgerData: any[],
  shareholderName: string,
  dateFrom: string,
  dateTo: string
) {
  const storeName = 'XPhone Store'
  const workbook = XLSX.utils.book_new()

  const data: any[][] = [
    [`كشف حساب ودفتر أستاذ حقوق المساهمين والشركاء — ${storeName}`],
    [`اسم الشريك / المساهم: ${shareholderName || 'جميع الشركاء'} | الفترة من ${formatDate(dateFrom)} إلى ${formatDate(dateTo)} | تاريخ الاستخراج: ${today()}`],
    [],
    ['تاريخ الحركة', 'نوع الحركة', 'البيان / التفاصيل', 'مدين (+) (ج.م)', 'دائن (-) (ج.م)', 'صافي القيمة / الرصيد الجاري (ج.م)', 'الحساب النقدي المقابل'],
  ]

  let totalDebit = 0
  let totalCredit = 0

  ledgerData.forEach(row => {
    totalDebit += row.debit || 0
    totalCredit += row.credit || 0
    data.push([
      formatDateTime(row.tx_date),
      row.tx_type_label || row.tx_type,
      row.description || '—',
      row.debit || 0,
      row.credit || 0,
      row.running_balance || 0,
      row.financial_account_name || '—',
    ])
  })

  data.push([])
  data.push(['المجموع الكلي للحركات', '', '', totalDebit, totalCredit, '', ''])

  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!cols'] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 35 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 22 },
  ]

  XLSX.utils.book_append_sheet(workbook, sheet, 'كشف أستاذ الشركاء')

  const filename = `Shareholder_Ledger_${shareholderName ? shareholderName.replace(/\s+/g, '_') : 'All'}_${dateFrom}_to_${dateTo}.xlsx`
  XLSX.writeFile(workbook, filename)
  return true
}

export async function exportExpensesExcel(
  expenses: any[],
  accruedExpenses: any[],
  dateFrom: string,
  dateTo: string
) {
  const storeName = 'XPhone Store'
  const workbook = XLSX.utils.book_new()

  const totalCash = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
  const totalAccrued = accruedExpenses.filter(a => a.status === 'unpaid').reduce((sum, a) => sum + (a.amount || 0), 0)

  const data: any[][] = [
    [`تقرير المصروفات النقدية والالتزامات المستحقة — ${storeName}`],
    [`الفترة من: ${formatDate(dateFrom)} إلى ${formatDate(dateTo)} | تاريخ الاستخراج: ${today()}`],
    [],
    ['إجمالي المصروفات النقدية الخزنية (ج.م):', totalCash],
    ['إجمالي المصروفات المستحقة واجبة السداد (ج.م):', totalAccrued],
    ['الإجمالي الكلي التكليفي للفترة (ج.م):', totalCash + totalAccrued],
    [],
    ['1. سجل المصروفات النقدية المسددة من الخزينة والحسابات:'],
    ['تاريخ المصروف', 'التصنيف', 'البيان والوصف', 'المبلغ (ج.م)', 'طبيعة المصروف', 'حساب الخصم النقدي'],
  ]

  expenses.forEach(exp => {
    data.push([
      exp.expense_date || '—',
      exp.category_name || 'عام',
      exp.description || '—',
      exp.amount || 0,
      exp.is_recurring ? `دوري (${exp.recurrence || 'monthly'})` : 'عارض',
      exp.financial_account_name || 'الخزينة الرئيسية',
    ])
  })

  data.push([])
  data.push(['المجموع الكلي للمصروفات النقدية:', '', '', totalCash, '', ''])
  data.push([])
  data.push(['2. سجل المصروفات المستحقة والالتزامات (Accrued Liabilities):'])
  data.push(['عنوان المصروف', 'المبلغ المستحق (ج.م)', 'التصنيف', 'تاريخ الاستحقاق', 'حالة السداد', 'الحساب النقدي المسدد منه'])

  accruedExpenses.forEach(accr => {
    data.push([
      accr.title || '—',
      accr.amount || 0,
      accr.category_name || 'عام',
      accr.due_date || 'غير محدد',
      accr.status === 'paid' ? 'مسدد' : 'مستحق كالتزام',
      accr.financial_account_name || '—',
    ])
  })

  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!cols'] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 35 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
  ]

  XLSX.utils.book_append_sheet(workbook, sheet, 'تقرير المصروفات')

  const filename = `Expenses_Report_${dateFrom}_to_${dateTo}.xlsx`
  XLSX.writeFile(workbook, filename)
  return true
}
