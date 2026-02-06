import type { EmergencyTemplate } from '../types';

export const emergencyTemplates: EmergencyTemplate[] = [
  {
    name: "Miokard Infarkti (gumon)",
    description: "Ko'krak qafasidagi kuchli og'riq, nafas siqishi, sovuq ter",
    data: {
      age: "62",
      gender: 'male',
      complaints: "To'satdan boshlangan, ko'krak qafasining markazida siquvchi, bosuvchi og'riq. Og'riq chap qo'lga va jag'ga tarqalmoqda. Sovuq ter bosishi, hansirash va o'lim qo'rquvi. Og'riq taxminan 20 daqiqa davom etmoqda, nitrogliserin ta'sir qilmayapti.",
      history: "10 yildan beri gipertoniya kasalligi, muntazam dori ichmaydi. Qandli diabet 2-tur. Chekadi (kuniga 1.5 quti).",
      familyHistory: "Otasida 55 yoshida miokard infarkti bo'lgan."
    }
  },
  {
    name: "Ishemik insult (gumon)",
    description: "Yuz assimetriyasi, nutq buzilishi, qo'l/oyoqda zaiflik",
    data: {
      age: "71",
      gender: 'female',
      complaints: "Taxminan 1 soat oldin to'satdan nutqi buzilgan, o'ng qo'li va oyog'ida zaiflik paydo bo'lgan. Og'zining o'ng burchagi osilib qolgan. Savollarga javob berishga qiynalyapti. Bosh og'rig'i va qusish yo'q.",
      history: "Atrial fibrilatsiya, antikoagulyantlarni nomuntazam qabul qiladi. Gipertoniya.",
      currentMedications: "Verapamil, vaqti-vaqti bilan varfarin.",
    }
  },
  {
    name: "Anafilaktik shok (gumon)",
    description: "To'satdan nafas qisilishi, toshmalar, qon bosimi tushishi",
    data: {
      age: "34",
      gender: 'female',
      complaints: "Noma'lum hasharot chaqishidan 5 daqiqa o'tgach, butun tanaga qizil toshmalar toshgan, hansirash, xirillash, bosh aylanishi va kuchli holsizlik paydo bo'lgan. Tomog'i qisilayotganini his qilmoqda.",
      allergies: "Penitsillinga allergiya bor.",
      objectiveData: "Teri qoplamalari qizargan, shishgan. Nafas olish shovqinli. arterial qon bosimi 80/50 mm.sim.ust. Yurak urish soni 130/min."
    }
  }
];
