"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type Language = "en" | "zh" | "es" | "tr" | "ru"

const translations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: "Dashboard", chat: "Chat", list: "List", inventory: "Inventory",
    shipments: "Shipments", repricing: "Repricing Rules", settings: "Settings",
    notifications: "Notifications", search: "Search", export: "Export", import: "Import",
    sync: "Sync", save: "Save Changes", logout: "Log Out", language: "Language",
    channels: "Active Channels", connected: "Connected", disconnected: "Disconnected",
    syncing: "Syncing", connect: "Connect", profile: "Profile", billing: "Billing",
    privacy: "Privacy Policy", terms: "Terms of Service", help: "Help Center",
    all: "All", active: "Active", out_of_stock: "Out of Stock", inactive: "Inactive",
    products: "products", cancel: "Cancel", create_listing: "Create Listing",
    scan_barcode: "Scan Barcode", csv_upload: "CSV Upload", manual_entry: "Manual Entry",
    no_notifications: "No notifications yet", mark_all_read: "Mark all read",
    listing_progress: "Listing in progress", welcome: "Welcome back",
  },
  zh: {
    dashboard: "仪表板", chat: "聊天", list: "上架", inventory: "库存",
    shipments: "发货", repricing: "定价规则", settings: "设置",
    notifications: "通知", search: "搜索", export: "导出", import: "导入",
    sync: "同步", save: "保存更改", logout: "退出登录", language: "语言",
    channels: "活跃渠道", connected: "已连接", disconnected: "未连接",
    syncing: "同步中", connect: "连接", profile: "个人资料", billing: "账单",
    privacy: "隐私政策", terms: "服务条款", help: "帮助中心",
    all: "全部", active: "活跃", out_of_stock: "缺货", inactive: "不活跃",
    products: "产品", cancel: "取消", create_listing: "创建上架",
    scan_barcode: "扫描条码", csv_upload: "CSV上传", manual_entry: "手动输入",
    no_notifications: "暂无通知", mark_all_read: "标记全部已读",
    listing_progress: "上架进行中", welcome: "欢迎回来",
  },
  es: {
    dashboard: "Panel", chat: "Chat", list: "Listar", inventory: "Inventario",
    shipments: "Envios", repricing: "Reglas de Precios", settings: "Ajustes",
    notifications: "Notificaciones", search: "Buscar", export: "Exportar", import: "Importar",
    sync: "Sincronizar", save: "Guardar Cambios", logout: "Cerrar Sesion", language: "Idioma",
    channels: "Canales Activos", connected: "Conectado", disconnected: "Desconectado",
    syncing: "Sincronizando", connect: "Conectar", profile: "Perfil", billing: "Facturacion",
    privacy: "Politica de Privacidad", terms: "Terminos de Servicio", help: "Centro de Ayuda",
    all: "Todos", active: "Activo", out_of_stock: "Sin Stock", inactive: "Inactivo",
    products: "productos", cancel: "Cancelar", create_listing: "Crear Listado",
    scan_barcode: "Escanear Codigo", csv_upload: "Subir CSV", manual_entry: "Entrada Manual",
    no_notifications: "Sin notificaciones", mark_all_read: "Marcar todo leido",
    listing_progress: "Listado en progreso", welcome: "Bienvenido de nuevo",
  },
  tr: {
    dashboard: "Panel", chat: "Sohbet", list: "Listele", inventory: "Envanter",
    shipments: "Gonderiler", repricing: "Fiyat Kurallari", settings: "Ayarlar",
    notifications: "Bildirimler", search: "Ara", export: "Disari Aktar", import: "Iceeri Aktar",
    sync: "Senkronize", save: "Degisiklikleri Kaydet", logout: "Cikis Yap", language: "Dil",
    channels: "Aktif Kanallar", connected: "Bagli", disconnected: "Bagli Degil",
    syncing: "Senkronize Ediliyor", connect: "Baglan", profile: "Profil", billing: "Fatura",
    privacy: "Gizlilik Politikasi", terms: "Kullanim Sartlari", help: "Yardim Merkezi",
    all: "Tumu", active: "Aktif", out_of_stock: "Stok Yok", inactive: "Inaktif",
    products: "urunler", cancel: "Iptal", create_listing: "Liste Olustur",
    scan_barcode: "Barkod Tara", csv_upload: "CSV Yukle", manual_entry: "Manuel Giris",
    no_notifications: "Henuz bildirim yok", mark_all_read: "Tumunu okundu isaretle",
    listing_progress: "Listeleme devam ediyor", welcome: "Tekrar hosgeldiniz",
  },
  ru: {
    dashboard: "Панель", chat: "Чат", list: "Листинг", inventory: "Инвентарь",
    shipments: "Отправки", repricing: "Правила Цен", settings: "Настройки",
    notifications: "Уведомления", search: "Поиск", export: "Экспорт", import: "Импорт",
    sync: "Синхронизация", save: "Сохранить", logout: "Выйти", language: "Язык",
    channels: "Активные Каналы", connected: "Подключен", disconnected: "Отключен",
    syncing: "Синхронизация", connect: "Подключить", profile: "Профиль", billing: "Биллинг",
    privacy: "Политика Конфиденциальности", terms: "Условия Сервиса", help: "Справка",
    all: "Все", active: "Активный", out_of_stock: "Нет в Наличии", inactive: "Неактивный",
    products: "товаров", cancel: "Отмена", create_listing: "Создать Листинг",
    scan_barcode: "Сканировать Штрихкод", csv_upload: "Загрузка CSV", manual_entry: "Ручной Ввод",
    no_notifications: "Уведомлений пока нет", mark_all_read: "Отметить все прочитанными",
    listing_progress: "Листинг в процессе", welcome: "Добро пожаловать",
  },
}

const langNames: Record<Language, string> = {
  en: "English", zh: "中文", es: "Espanol", tr: "Turkce", ru: "Русский",
}

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
  langNames: Record<Language, string>
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  langNames,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en")

  useEffect(() => {
    const saved = localStorage.getItem("siml_lang") as Language
    if (saved && translations[saved]) setLangState(saved)
  }, [])

  const setLang = (l: Language) => {
    setLangState(l)
    localStorage.setItem("siml_lang", l)
  }

  const t = (key: string) => translations[lang]?.[key] || translations.en[key] || key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, langNames }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
