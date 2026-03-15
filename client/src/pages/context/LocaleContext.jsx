import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/api';

// --- CONSTANTS ---

const LocaleContext = createContext(null);

const DEFAULT_LANGUAGE = 'en';
const DEFAULT_CURRENCY = 'EUR'; 

const LANGUAGES = [
  { code: 'en', name: 'English', locale: 'en-US' },
  { code: 'fi', name: 'Finnish', locale: 'fi-FI' },
  { code: 'sv', name: 'Swedish', locale: 'sv-SE' },
  { code: 'de', name: 'German', locale: 'de-DE' },
  { code: 'fr', name: 'French', locale: 'fr-FR' },
  { code: 'es', name: 'Spanish', locale: 'es-ES' },
  { code: 'it', name: 'Italian', locale: 'it-IT' },
  { code: 'ja', name: 'Japanese', locale: 'ja-JP' },
  { code: 'zh', name: 'Chinese', locale: 'zh-CN' },
  { code: 'ru', name: 'Russian', locale: 'ru-RU' },
  { code: 'tr', name: 'Turkish', locale: 'tr-TR' },
  { code: 'nl', name: 'Dutch', locale: 'nl-NL' },
  { code: 'no', name: 'Norwegian', locale: 'nb-NO' },
  { code: 'da', name: 'Danish', locale: 'da-DK' },
  { code: 'pl', name: 'Polish', locale: 'pl-PL' },
  { code: 'pt', name: 'Portuguese', locale: 'pt-PT' },
  { code: 'cs', name: 'Czech', locale: 'cs-CZ' },
  { code: 'hu', name: 'Hungarian', locale: 'hu-HU' },
  { code: 'ro', name: 'Romanian', locale: 'ro-RO' },
  { code: 'bg', name: 'Bulgarian', locale: 'bg-BG' },
  { code: 'sk', name: 'Slovak', locale: 'sk-SK' },
  { code: 'lt', name: 'Lithuanian', locale: 'lt-LT' },
  { code: 'lv', name: 'Latvian', locale: 'lv-LV' },
  { code: 'et', name: 'Estonian', locale: 'et-EE' },
  { code: 'el', name: 'Greek', locale: 'el-GR' },
  { code: 'bn', name: 'Bengali', locale: 'bn-BD' },
  { code: 'hi', name: 'Hindi', locale: 'hi-IN' },
  { code: 'ar', name: 'Arabic', locale: 'ar-SA' }
];

// COMPLETE MAPPING FOR ALL COUNTRIES
const COUNTRY_TO_CURRENCY = {
  "Afghanistan": "AFN", "Albania": "ALL", "Algeria": "DZD", "Andorra": "EUR", "Angola": "AOA", 
  "Antigua and Barbuda": "XCD", "Argentina": "ARS", "Armenia": "AMD", "Australia": "AUD", "Austria": "EUR", 
  "Azerbaijan": "AZN", "Bahamas": "BSD", "Bahrain": "BHD", "Bangladesh": "BDT", "Barbados": "BBD", 
  "Belarus": "BYN", "Belgium": "EUR", "Belize": "BZD", "Benin": "XOF", "Bhutan": "BTN", 
  "Bolivia": "BOB", "Bosnia and Herzegovina": "BAM", "Botswana": "BWP", "Brazil": "BRL", "Brunei": "BND", 
  "Bulgaria": "BGN", "Burkina Faso": "XOF", "Burundi": "BIF", "Cabo Verde": "CVE", "Cambodia": "KHR", 
  "Cameroon": "XAF", "Canada": "CAD", "Central African Republic": "XAF", "Chad": "XAF", "Chile": "CLP", 
  "China": "CNY", "Colombia": "COP", "Comoros": "KMF", "Congo (Congo-Brazzaville)": "XAF", 
  "Costa Rica": "CRC", "Croatia": "EUR", "Cuba": "CUP", "Cyprus": "EUR", "Czechia (Czech Republic)": "CZK", 
  "Democratic Republic of the Congo": "CDF", "Denmark": "DKK", "Djibouti": "DJF", "Dominica": "XCD", 
  "Dominican Republic": "DOP", "Ecuador": "USD", "Egypt": "EGP", "El Salvador": "USD", "Equatorial Guinea": "XAF", 
  "Eritrea": "ERN", "Estonia": "EUR", "Eswatini (Swaziland)": "SZL", "Ethiopia": "ETB", "Fiji": "FJD", 
  "Finland": "EUR", "France": "EUR", "Gabon": "XAF", "Gambia": "GMD", "Georgia": "GEL", "Germany": "EUR", 
  "Ghana": "GHS", "Greece": "EUR", "Grenada": "XCD", "Guatemala": "GTQ", "Guinea": "GNF", "Guinea-Bissau": "XOF", 
  "Guyana": "GYD", "Haiti": "HTG", "Honduras": "HNL", "Hungary": "HUF", "Iceland": "ISK", "India": "INR", 
  "Indonesia": "IDR", "Iran": "IRR", "Iraq": "IQD", "Ireland": "EUR", "Israel": "ILS", "Italy": "EUR", 
  "Jamaica": "JMD", "Japan": "JPY", "Jordan": "JOD", "Kazakhstan": "KZT", "Kenya": "KES", "Kiribati": "AUD", 
  "Kuwait": "KWD", "Kyrgyzstan": "KGS", "Laos": "LAK", "Latvia": "EUR", "Lebanon": "LBP", "Lesotho": "LSL", 
  "Liberia": "LRD", "Libya": "LYD", "Liechtenstein": "CHF", "Lithuania": "EUR", "Luxembourg": "EUR", 
  "Madagascar": "MGA", "Malawi": "MWK", "Malaysia": "MYR", "Maldives": "MVR", "Mali": "XOF", "Malta": "EUR", 
  "Marshall Islands": "USD", "Mauritania": "MRU", "Mauritius": "MUR", "Mexico": "MXN", "Micronesia": "USD", 
  "Moldova": "MDL", "Monaco": "EUR", "Mongolia": "MNT", "Montenegro": "EUR", "Morocco": "MAD", 
  "Mozambique": "MZN", "Myanmar (Burma)": "MMK", "Namibia": "NAD", "Nauru": "AUD", "Nepal": "NPR", 
  "Netherlands": "EUR", "New Zealand": "NZD", "Nicaragua": "NIO", "Niger": "XOF", "Nigeria": "NGN", 
  "North Korea": "KPW", "North Macedonia": "MKD", "Norway": "NOK", "Oman": "OMR", "Pakistan": "PKR", 
  "Palau": "USD", "Panama": "USD", "Papua New Guinea": "PGK", "Paraguay": "PYG", "Peru": "PEN", 
  "Philippines": "PHP", "Poland": "PLN", "Portugal": "EUR", "Qatar": "QAR", "Romania": "RON", 
  "Russia": "RUB", "Rwanda": "RWF", "Saint Kitts and Nevis": "XCD", "Saint Lucia": "XCD", 
  "Saint Vincent and the Grenadines": "XCD", "Samoa": "WST", "San Marino": "EUR", "Sao Tome and Principe": "STN", 
  "Saudi Arabia": "SAR", "Senegal": "XOF", "Serbia": "RSD", "Seychelles": "SCR", "Sierra Leone": "SLE", 
  "Singapore": "SGD", "Slovakia": "EUR", "Slovenia": "EUR", "Solomon Islands": "SBD", "Somalia": "SOS", 
  "South Africa": "ZAR", "South Korea": "KRW", "South Sudan": "SSP", "Spain": "EUR", "Sri Lanka": "LKR", 
  "Sudan": "SDG", "Suriname": "SRD", "Sweden": "SEK", "Switzerland": "CHF", "Syria": "SYP", "Taiwan": "TWD", 
  "Tajikistan": "TJS", "Tanzania": "TZS", "Thailand": "THB", "Timor-Leste": "USD", "Togo": "XOF", 
  "Tonga": "TOP", "Trinidad and Tobago": "TTD", "Tunisia": "TND", "Turkey": "TRY", "Turkmenistan": "TMT", 
  "Tuvalu": "AUD", "Uganda": "UGX", "Ukraine": "UAH", "United Arab Emirates": "AED", "United Kingdom": "GBP", 
  "United States": "USD", "Uruguay": "UYU", "Uzbekistan": "UZS", "Vanuatu": "VUV", "Vatican City": "EUR", 
  "Venezuela": "VES", "Vietnam": "VND", "Yemen": "YER", "Zambia": "ZMW", "Zimbabwe": "ZWL"
};

const resolveCurrencyFromCountry = (countryName) => {
  if (!countryName || typeof countryName !== 'string') return DEFAULT_CURRENCY;
  const key = countryName.trim();
  
  // 1. Direct match
  if (COUNTRY_TO_CURRENCY[key]) return COUNTRY_TO_CURRENCY[key];
  
  // 2. Fuzzy match
  const knownCountries = Object.keys(COUNTRY_TO_CURRENCY);
  const match = knownCountries.find(c => key.toLowerCase().includes(c.toLowerCase()));
  
  return match ? COUNTRY_TO_CURRENCY[match] : DEFAULT_CURRENCY;
};

const LocaleProvider = ({ children }) => {
  const [language, setLanguage] = useState(localStorage.getItem('language') || DEFAULT_LANGUAGE);
  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem('currency') || DEFAULT_CURRENCY;
  });
  
  const [rates, setRates] = useState({ EUR: 1 }); 
  const [ratesError, setRatesError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(0);

  // CACHE CONFIG:
  const CACHE_KEY = 'exchangeRates_v3'; 
  const CACHE_TIME_KEY = 'exchangeRatesUpdatedAt_v3';

  useEffect(() => {
    const ENDPOINTS = [
      'https://open.er-api.com/v6/latest/EUR',
      'https://api.exchangerate.host/latest?base=EUR'
    ];

    const fetchJSON = (url, ms = 8000) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), ms);
      return fetch(url, { signal: controller.signal, mode: 'cors' })
        .then(r => r.json())
        .finally(() => clearTimeout(t));
    };

    const refreshRates = async () => {
      for (const url of ENDPOINTS) {
        try {
          const d = await fetchJSON(url);
          const validRates = d?.rates || d?.conversion_rates;
          if (validRates && typeof validRates === 'object') {
            const next = { ...validRates };
            next.EUR = 1;
            setRates(next);
            setRatesError('');
            const now = Date.now();
            setLastUpdated(now);
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(next));
              localStorage.setItem(CACHE_TIME_KEY, String(now));
            } catch (_) {}
            return;
          }
        } catch (_) {}
      }
      setRatesError('Live rates unavailable');
    };

    // Cache Logic
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const ts = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
      const oneHour = 60 * 60 * 1000; 
      
      if (cached) {
        setRates(JSON.parse(cached));
        setLastUpdated(ts);
      }
      
      if (!cached || !ts || Date.now() - ts > oneHour) {
        refreshRates();
      }
    } catch (_) {
      refreshRates();
    }

    const id = setInterval(refreshRates, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // Geolocation Logic
  useEffect(() => {
    const storedCurrency = localStorage.getItem('currency');

    const setCurrencyIfValid = (code) => {
      if (code && typeof code === 'string') {
        const target = code.toUpperCase();
        if (target !== currency) {
          setCurrency(target);
          try { localStorage.setItem('currency', target); } catch (_) {}
        }
      }
    };

    const fetchGeo = () => {
      if (storedCurrency) return; 

      apiFetch('/api/geo')
        .then(r => r.json())
        .then(info => {
          // Priority 1: API currency, Priority 2: Map country name
          const ccy = info?.currency || resolveCurrencyFromCountry(info?.country_name);
          setCurrencyIfValid(ccy || DEFAULT_CURRENCY);
        })
        .catch(() => {});
    };

    const token = localStorage.getItem('userToken');
    if (token) {
      apiFetch('/api/user/profile', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d?.success && d.user?.country) {
            const ccy = resolveCurrencyFromCountry(d.user.country);
            setCurrencyIfValid(ccy);
          } else {
            fetchGeo();
          }
        })
        .catch(() => fetchGeo());
    } else {
      setCurrencyIfValid(DEFAULT_CURRENCY);
    }
  }, []); 

  // Conversion
  const convert = useMemo(() => (amount, base = 'EUR') => {
    const n = Number(amount || 0);
    const baseRate = rates[base] || 1; 
    const targetRate = rates[currency];

    if (!targetRate) return n; 

    return n * (targetRate / baseRate);
  }, [rates, currency]);

  const convertTo = useMemo(() => (amount, targetCurrency, base = 'EUR') => {
    const n = Number(amount || 0);
    const baseRate = rates[base] || 1;
    const targetRate = rates[targetCurrency];
    
    if (!targetRate) return n;

    return n * (targetRate / baseRate);
  }, [rates]);

  // Formatters
  const format = useMemo(() => (amount, base = 'EUR') => {
    const loc = (LANGUAGES.find(l => l.code === language)?.locale) || 'en-US';
    let value = convert(amount, base);
    
    let displayCurrency = currency;
    if (!rates[currency]) {
      displayCurrency = base || DEFAULT_CURRENCY; 
    }

    try {
      return new Intl.NumberFormat(loc, { style: 'currency', currency: displayCurrency }).format(value);
    } catch (e) {
      return `${displayCurrency} ${value.toFixed(2)}`;
    }
  }, [convert, currency, language, rates]);

  const formatPrecise = useMemo(() => (amount, base = 'EUR', minFrac = 4, maxFrac = 6) => {
    const loc = (LANGUAGES.find(l => l.code === language)?.locale) || 'en-US';
    let value = convert(amount, base);
    
    let displayCurrency = currency;
    if (!rates[currency]) {
      displayCurrency = base || DEFAULT_CURRENCY;
    }

    try {
      return new Intl.NumberFormat(loc, {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: minFrac,
        maximumFractionDigits: maxFrac
      }).format(value);
    } catch (e) {
      return `${displayCurrency} ${value.toFixed(minFrac)}`;
    }
  }, [convert, currency, language, rates]);

  const formatTo = useMemo(() => (amount, targetCurrency, base = 'EUR', minFrac = 2, maxFrac = 2) => {
    const loc = (LANGUAGES.find(l => l.code === language)?.locale) || 'en-US';
    const value = convertTo(amount, targetCurrency, base);
    const displayCurrency = rates[targetCurrency] ? targetCurrency : base;

    try {
      return new Intl.NumberFormat(loc, {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: minFrac,
        maximumFractionDigits: maxFrac
      }).format(value);
    } catch (e) {
      return `${displayCurrency} ${value.toFixed(2)}`;
    }
  }, [convertTo, language, rates]);

  const formatRange = useMemo(() => (minAmount, maxAmount, base = 'EUR') => {
    return `${format(minAmount, base)} - ${format(maxAmount, base)}`;
  }, [format]);

  // --- REMOVED TEXT TRANSLATION LOGIC (tMap, t function) ---

  const value = { 
    language, currency, 
    setLanguage, setCurrency, 
    format, formatPrecise, formatRange, formatTo, 
    convert, convertTo, 
    LANGUAGES, rates, ratesError, lastUpdated 
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => useContext(LocaleContext);

// --- REMOVED useAutoTranslate HOOK ---

export { LocaleProvider };
