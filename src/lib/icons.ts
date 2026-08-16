import {
  Home, UtensilsCrossed, ShoppingBasket, Tv, ShoppingBag, TrainFront, Zap, Gamepad2, HeartPlus,
  Coffee, Pizza, Car, Fuel, Plane, Bike, ParkingCircle,
  Pill, Stethoscope, Dumbbell, PawPrint, GraduationCap,
  Music, Film, BookOpen, Gift, Palette, Trophy, PartyPopper, Luggage,
  Shirt, Footprints, Sparkles, Package,
  CreditCard, Landmark, Wallet, TrendingUp, TrendingDown, Receipt, Coins, Gem,
  Briefcase, Laptop, Monitor, Calendar, Mail, Lock,
  Baby, Users, Leaf, Sun, Heart, Star, Bell, Target,
  Wifi, Phone, Wrench, Droplet, Flame, Sofa, WashingMachine, Trash2, Building2,
  Search, RefreshCw, TriangleAlert, ArrowLeftRight, Tag,
  type LucideIcon,
} from "lucide-react";

// Rev 05 §1.2/§9: the curated icon set, stored as "lucide:<key>" in an
// icon/emoji text column (categories, accounts, cards, recurring_items all
// share the same convention). Rev 07 #10 added a real Emoji tab alongside
// it — see EMOJI_REGISTRY below, stored under its own "emoji:" prefix.
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  home: Home, "utensils-crossed": UtensilsCrossed, basket: ShoppingBasket, tv: Tv,
  "shopping-bag": ShoppingBag, train: TrainFront, bolt: Zap, "game-pad": Gamepad2, "heart-plus": HeartPlus,
  coffee: Coffee, pizza: Pizza, car: Car, fuel: Fuel, plane: Plane, bike: Bike, parking: ParkingCircle,
  pill: Pill, stethoscope: Stethoscope, dumbbell: Dumbbell, paw: PawPrint, "graduation-cap": GraduationCap,
  music: Music, film: Film, book: BookOpen, gift: Gift, palette: Palette, trophy: Trophy, party: PartyPopper, luggage: Luggage,
  shirt: Shirt, footprints: Footprints, sparkles: Sparkles, package: Package,
  "credit-card": CreditCard, landmark: Landmark, wallet: Wallet, "trending-up": TrendingUp, "trending-down": TrendingDown,
  receipt: Receipt, coins: Coins, gem: Gem,
  briefcase: Briefcase, laptop: Laptop, monitor: Monitor, calendar: Calendar, mail: Mail, lock: Lock,
  baby: Baby, users: Users, leaf: Leaf, sun: Sun, heart: Heart, star: Star, bell: Bell, target: Target,
  wifi: Wifi, phone: Phone, wrench: Wrench, droplet: Droplet, flame: Flame, sofa: Sofa,
  "washing-machine": WashingMachine, trash: Trash2, building: Building2,
  search: Search, "refresh-cw": RefreshCw, "alert-triangle": TriangleAlert, "arrow-left-right": ArrowLeftRight,
  tag: Tag,
};

const LUCIDE_PREFIX = "lucide:";
const EMOJI_PREFIX = "emoji:";

export function lucideKey(key: string): string {
  return `${LUCIDE_PREFIX}${key}`;
}

export function isLucideValue(value: string | null | undefined): boolean {
  return !!value?.startsWith(LUCIDE_PREFIX);
}

export function isDataUrlValue(value: string | null | undefined): boolean {
  return !!value?.startsWith("data:");
}

export function resolveLucideIcon(value: string | null | undefined): LucideIcon | null {
  if (!isLucideValue(value)) return null;
  const key = value!.slice(LUCIDE_PREFIX.length);
  return ICON_REGISTRY[key] ?? null;
}

// Rev 07 #10: a curated emoji set for the icon picker's Emoji tab, keyed
// the same way as ICON_REGISTRY so search works identically.
export const EMOJI_REGISTRY: Record<string, string> = {
  house: "🏠", food: "🍔", groceries: "🛒", tv: "📺", shopping: "🛍️", train: "🚆",
  bolt: "⚡", game: "🎮", "heart-plus": "❤️‍🩹", coffee: "☕", pizza: "🍕", car: "🚗",
  fuel: "⛽", plane: "✈️", bike: "🚲", parking: "🅿️", pill: "💊", doctor: "🩺",
  gym: "🏋️", pet: "🐾", grad: "🎓", music: "🎵", movie: "🎬", book: "📖",
  gift: "🎁", art: "🎨", trophy: "🏆", party: "🎉", travel: "🧳", shirt: "👕",
  walk: "👣", sparkle: "✨", box: "📦", card: "💳", bank: "🏦", wallet: "👛",
  up: "📈", down: "📉", receipt: "🧾", coin: "🪙", gem: "💎", briefcase: "💼",
  laptop: "💻", desktop: "🖥️", calendar: "📅", mail: "✉️", lock: "🔒", baby: "👶",
  people: "👥", leaf: "🍃", sun: "☀️", heart: "❤️", star: "⭐", bell: "🔔",
  target: "🎯", wifi: "📶", phone: "📞", tool: "🔧", water: "💧", fire: "🔥",
  sofa: "🛋️", laundry: "🧺", trash: "🗑️", building: "🏢", cake: "🎂", dog: "🐶",
  cat: "🐱", beer: "🍺", wine: "🍷", headphones: "🎧", soccer: "⚽", basketball: "🏀",
  fish: "🎣", broom: "🧹", shower: "🚿", bed: "🛏️", smile: "😀", cool: "😎",
  celebrate: "🥳", sleep: "😴", money: "🤑",
};

export function emojiKey(char: string): string {
  return `${EMOJI_PREFIX}${char}`;
}

export function isEmojiValue(value: string | null | undefined): boolean {
  return !!value?.startsWith(EMOJI_PREFIX);
}

export function resolveEmoji(value: string | null | undefined): string | null {
  if (!isEmojiValue(value)) return null;
  return value!.slice(EMOJI_PREFIX.length) || null;
}

// Rev 05 §9: preloaded default categories, exact icon + color per spec.
export const DEFAULT_CATEGORIES = [
  { name: "Bills", icon: lucideKey("home"), color: "#d0492f" },
  { name: "Food", icon: lucideKey("utensils-crossed"), color: "#e8792e" },
  { name: "Groceries", icon: lucideKey("basket"), color: "#2e9e6b" },
  { name: "Subscriptions", icon: lucideKey("tv"), color: "#2a78d6" },
  { name: "Shopping", icon: lucideKey("shopping-bag"), color: "#7a5cc0" },
  { name: "Transit", icon: lucideKey("train"), color: "#e87ba4" },
  { name: "Utilities", icon: lucideKey("bolt"), color: "#d8a020" },
  { name: "Play", icon: lucideKey("game-pad"), color: "#2aa79b" },
  { name: "Health", icon: lucideKey("heart-plus"), color: "#b23b52" },
] as const;
