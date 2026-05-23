import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const setPersistentAuth = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) { }
  document.cookie = `${key}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`;
}

export const getPersistentAuth = (key: string) => {
  let val = null;
  try {
    val = localStorage.getItem(key);
  } catch (e) { }

  if (!val) {
    const cookies = document.cookie.split(';');
    for (let c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === key && v) {
        val = decodeURIComponent(v);
        try {
          localStorage.setItem(key, val);
        } catch (e) { }
        break;
      }
    }
  }
  return val;
}

export const clearPersistentAuth = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (e) { }
  document.cookie = `${key}=; max-age=0; path=/; SameSite=Lax`;
}
