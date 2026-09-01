const COMMON_WORDS = [
  "sifre",
  "parola",
  "deneme",
  "kullanici",
  "password",
  "admin",
  "mavikent",
  "yonetim",
  "yonetici",
  "apartman",
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
  "cimbom",
  "istanbul",
  "ankara",
  "izmir",
  "antalya",
  "trabzon",
  "turkiye",
  "mehmet",
  "mustafa",
  "ahmet",
  "huseyin",
  "ibrahim",
  "zeynep",
  "murat",
  "qwerty",
  "asdf",
  "iloveyou",
  "letmein",
];

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

const YEAR_PATTERN = /(19|20)\d{2}/g;

const TR_LETTERS = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

export const MIN_PASSWORD_LENGTH = 8;

const STRENGTH = [
  { label: "Şifre gücü", variant: "neutral" },
  { label: "Çok Zayıf", variant: "veryweak" },
  { label: "Zayıf", variant: "weak" },
  { label: "Orta", variant: "fair" },
  { label: "İyi", variant: "good" },
  { label: "Güçlü", variant: "strong" },
];

const MAX_SCORE = STRENGTH.length - 1;

function collapseRepeats(password) {
  return password.replace(/(.)\1{4,}/gu, "$1$1");
}

function longestSequenceLength(password) {
  const lower = password.toLowerCase();
  let longest = 0;
  for (const sequence of SEQUENCES) {
    let streak = 1;
    let direction = 0;
    for (let i = 1; i < lower.length; i++) {
      const previous = sequence.indexOf(lower[i - 1]);
      const current = sequence.indexOf(lower[i]);
      const step = previous === -1 || current === -1 ? 0 : current - previous;
      if (step !== 1 && step !== -1) {
        streak = 1;
        direction = 0;
      } else if (step === direction) {
        streak++;
      } else {
        streak = 2;
        direction = step;
      }
      if (streak >= 4) longest = Math.max(longest, streak);
    }
  }
  return longest;
}

function foldToLetters(password) {
  return password
    .toLowerCase()
    .replace(/[çğıöşü]/g, (letter) => TR_LETTERS[letter])
    .replace(/[^a-z]/g, "");
}

function findCommonWords(password) {
  const letters = foldToLetters(password);
  const hits = [];
  for (const word of COMMON_WORDS) {
    const occurrences = letters.split(word).length - 1;
    if (occurrences > 0) hits.push({ word, occurrences });
  }
  return hits;
}

function periodLength(password) {
  for (let period = 1; period <= password.length / 2; period++) {
    let isPeriodic = true;
    for (let i = period; i < password.length; i++) {
      if (password[i] !== password[i - period]) {
        isPeriodic = false;
        break;
      }
    }
    if (isPeriodic) return period;
  }
  return password.length;
}

function scorePassword(password) {
  if (!password) return { score: 0, isPredictable: false, isPatterned: false };

  let pool = 0;
  if (/[a-zçğıöşü]/.test(password)) pool += 29;
  if (/[A-ZÇĞİÖŞÜ]/.test(password)) pool += 29;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(password)) pool += 32;

  const collapsed = collapseRepeats(password);
  const period = periodLength(password);
  const isPeriodic = period < password.length;
  let effectiveLength = isPeriodic ? Math.min(period + 1, collapsed.length) : collapsed.length;

  const words = findCommonWords(password);
  for (const { word, occurrences } of words) {
    effectiveLength -= word.length * occurrences;
  }
  const years = password.match(YEAR_PATTERN)?.length ?? 0;
  effectiveLength -= 3 * years;

  const sequenceLength = longestSequenceLength(password);
  if (sequenceLength > 0) effectiveLength -= sequenceLength - 1;

  const bits = Math.max(effectiveLength, 1) * Math.log2(pool || 1);
  const score = bits < 30 ? 1 : bits < 45 ? 2 : bits < 60 ? 3 : bits < 75 ? 4 : 5;

  return {
    score,
    isPredictable: words.length > 0 || years > 0,
    isPatterned: isPeriodic || sequenceLength > 0 || collapsed.length < password.length,
  };
}

function buildMeter(length, score) {
  return {
    variant: STRENGTH[score].variant,
    label:
      length > 0 && length < MIN_PASSWORD_LENGTH
        ? `${MIN_PASSWORD_LENGTH - length} karakter daha`
        : STRENGTH[score].label,
    score,
    max: MAX_SCORE,
  };
}

function buildRules(password, confirmPassword, strength) {
  const isPasswordEmpty = password.length === 0;
  return [
    {
      id: "length",
      label: `${MIN_PASSWORD_LENGTH}+ karakter`,
      isMet: password.length >= MIN_PASSWORD_LENGTH,
      isPending: isPasswordEmpty,
    },
    {
      id: "match",
      label: "Şifreler eşleşiyor",
      isMet: confirmPassword.length > 0 && password === confirmPassword,
      isPending: confirmPassword.length === 0,
    },
    {
      id: "predictable",
      label: "Tahmin edilebilir bilgi yok",
      isMet: !isPasswordEmpty && !strength.isPredictable,
      isPending: isPasswordEmpty,
    },
    {
      id: "pattern",
      label: "Tekrar eden kalıp yok",
      isMet: !isPasswordEmpty && !strength.isPatterned,
      isPending: isPasswordEmpty,
    },
  ];
}

export function evaluatePassword(password, confirmPassword) {
  const strength = scorePassword(password);
  return {
    meter: buildMeter(password.length, strength.score),
    rules: buildRules(password, confirmPassword, strength),
  };
}
