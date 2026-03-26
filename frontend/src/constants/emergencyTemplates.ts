import type { EmergencyTemplate } from '../types';
import type { Language } from '../i18n/LanguageContext';

// Templates for each language
const templatesByLanguage: Record<Language, EmergencyTemplate[]> = {
  'uz-L': [
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
    },
    {
      name: "Qon aylanish tizimining yetishmovchiligi",
      description: "Yurak yetishmovchiligi, o'tkir nafas qisilishi, oyoqlarda shish",
      data: {
        age: "68",
        gender: 'male',
        complaints: "3 kun davomida nafas olish qiyinlashib bormoqda, xususan yotgan paytda. O'ng oyoq va oyog'i shishib ketgan. Kekirganda ko'k jele ko'rinishida balg'am chiqmoqda. Tunda nafas qisilishi bilan uyg'onmoqda.",
        history: "Yurak yetishmovchiligi 3 yil, gipertoniya 15 yil. Ilgari miokard infarkti bo'lgan.",
        currentMedications: "Furosemid, spironolakton, enalapril."
      }
    },
    {
      name: "O'tkir pankreatit",
      description: "Qorinning yuqori qismida kuchli og'riq, qusish",
      data: {
        age: "45",
        gender: 'male',
        complaints: "Kechqurun to'yib yegandan so'ng qorinning yuqori qismida, xususan chap tomonda kuchli og'riq boshlangan. Og'riq orqaga tarqalmoqda. 5 marta qusgan, og'riq kamaymayapti.",
        history: "O't tosh kasalligi, 2 yil oldin o't pufagi operatsiyasi qilingan. Muntazam spirtli ichimlik iste'mol qiladi.",
        objectiveData: "Qorin kuchli og'riqli, mushaklar kuchli kuchaygan. Qorinning yuqori qismida chuqurla bosganda og'riq kuchayadi."
      }
    },
    {
      name: "Giperglikemik giperosmolyar holat",
      description: "Qandli diabet komplikatsiyasi, og'ir suvsizlanish",
      data: {
        age: "58",
        gender: 'female',
        complaints: "5 kun davomida kuchli chanqoqlik, ko'p siydik chiqish, bosh og'rig'i va ko'rishning buzilishi. 2 kun davomida ko'p uxlayapti, lekin holsiz. Nafas olish tezlashgan.",
        history: "Qandli diabet 2-tur 12 yil, insulin olmaydi. So'nggi haftalarda dori ichishni to'xtatgan.",
        objectiveData: "Teri va shilliq qoplamalari quruq. Nafas olish chuqur va tez. Qon bosimi 90/60."
      }
    },
    {
      name: "O'tkir appenditsit",
      description: "Qorinning o'ng pastki qismida og'riq, isitma",
      data: {
        age: "24",
        gender: 'male',
        complaints: "Kecha qorin markazida og'riq boshlangan, bugun o'ng pastki qismiga o'tgan. Og'riq doimiy, kuchayib bormoqda. 2 marta qusgan, isitma 38.2°C.",
        history: "Oldin appenditsit bo'lmagan."
      }
    },
    {
      name: "Bronxial astma hujumi",
      description: "O'tkir nafas qisilishi, xirillash, nafas olish qiyinlashishi",
      data: {
        age: "29",
        gender: 'female',
        complaints: "Bugun ertalabdan boshlab nafas olish qiyinlashdi, xirillash paydo bo'ldi. Salbutamol inhalyatsiyasi vaqtinchalik yordam berdi. Hozir nafas olish juda qiyin, gapirishga kuch yetmayapti.",
        history: "Bronxial astma 10 yil. So'nggi oyda tez-tez hujumlar bo'lmoqda.",
        currentMedications: "Salbutamol inhalyatori, beklometazon."
      }
    }
  ],
  'uz-C': [
    {
      name: "Миокард Инфаркти (гумон)",
      description: "Кўкрак қафасидаги кучли оғриқ, нафас сиқиши, совуқ тер",
      data: {
        age: "62",
        gender: 'male',
        complaints: "Тўсатдан бошланган, кўкрак қафасининг марказида сиқувчи, босувчи оғриқ. Оғриқ чап қўлга ва жагъга таралмоқда. Совуқ тер босиши, ҳансираш ва ўлим қўрқуви. Оғриқ тахминан 20 дақиқа давом этмоқда, нитроглицерин таъсир қилмаяпти.",
        history: "10 йилдан бери гипертония касаллиги, мунтазам дори ичмайди. Қандли диабет 2-тур. Чекади (кунига 1.5 қути).",
        familyHistory: "Отасида 55 ёшида миокард инфаркти бўлган."
      }
    },
    {
      name: "Ишемик инсульт (гумон)",
      description: "Юз ассиметрияси, нутқ бузилиши, қўл/оёқда заифлик",
      data: {
        age: "71",
        gender: 'female',
        complaints: "Тахминан 1 соат олдин тўсатдан нутқи бузилган, ўнг қўли ва оёғида заифлик пайдо бўлган. Оғзининг ўнг бурчаги осилиб қолган. Саволларга жавоб беришга қийналяпти. Бош оғриғи ва қусиш йўқ.",
        history: "Атриал фибрилляция, антикоагулянтларни номунтазам қабул қилади. Гипертония.",
        currentMedications: "Верапамил, вақти-вақти билан варфарин.",
      }
    },
    {
      name: "Анафилактик шок (гумон)",
      description: "Тўсатдан нафас қисилиши, тошмалар, қон босими тушиши",
      data: {
        age: "34",
        gender: 'female',
        complaints: "Номаълум ҳашарот чақишидан 5 дақиқа ўтгач, бутун танага қизил тошмалар тошган, ҳансираш, хиррилаш, бош айланиши ва кучли ҳолсизлик пайдо бўлган. Томоғи қисилаётганини ҳис қилмоқда.",
        allergies: "Пенициллинга аллергия бор.",
        objectiveData: "Тери қопламалари қизарган, шишган. Нафас олиш шовқинли. Артериал қон босими 80/50 мм.сим.уст. Юрак уриш сони 130/мин."
      }
    },
    {
      name: "Қон айланиш тизимининг етишмовчилиги",
      description: "Юрак етишмовчилиги, ўткир нафас қисилиши, оёқларда шиш",
      data: {
        age: "68",
        gender: 'male',
        complaints: "3 кун давомида нафас олиш қийинлашиб бормоқда, хусусан ётган пайтда. Ўнг оёқ ва оёғи шишиб кетган. Кекирганда кўк желе кўринишида балғам чиқмоқда. Тунда нафас қисилиши билан уйғонмоқда.",
        history: "Юрак етишмовчилиги 3 йил, гипертония 15 йил. Илгари миокард инфаркти бўлган.",
        currentMedications: "Фуросемид, спиронолактон, еналаприл."
      }
    },
    {
      name: "Ўткир панкреатит",
      description: "Қориннинг юқори қисмида кучли оғриқ, қусиш",
      data: {
        age: "45",
        gender: 'male',
        complaints: "Кечқурун тўйиб егандан сўнг қориннинг юқори қисмида, хусусан чап томонда кучли оғриқ бошланган. Оғриқ орқага таралмоқда. 5 марта қусган, оғриқ камаймаяпти.",
        history: "Ўт тош касаллиги, 2 йил олдин ўт пуфаги операцияси қилинган. Мунтазам спиртли ичимлик истеъмол қилади.",
        objectiveData: "Қорин кучли оғриқли, мушаклар кучли кучайган. Қориннинг юқори қисмида чуқурла босганда оғриқ кучаяди."
      }
    },
    {
      name: "Гипергликемик гиперосмоляр ҳолат",
      description: "Қандли диабет компликацияси, оғир сувсизланиш",
      data: {
        age: "58",
        gender: 'female',
        complaints: "5 кун давомида кучли чанқоқлик, кўп сийдик чиқиш, бош оғриғи ва кўришнинг бузилиши. 2 кун давомида кўп ухлаяпти, лекин ҳолсиз. Нафас олиш тезлашган.",
        history: "Қандли диабет 2-тур 12 йил, инсулин олмайди. Сўнгги ҳафталарда дори ичишни тўхтатган.",
        objectiveData: "Тери ва шиллиқ қопламалари қуруқ. Нафас олиш чуқур ва тез. Қон босими 90/60."
      }
    },
    {
      name: "Ўткир аппендицит",
      description: "Қориннинг ўнг пастки қисмида оғриқ, иситма",
      data: {
        age: "24",
        gender: 'male',
        complaints: "Кеча қорин марказида оғриқ бошланган, бугун ўнг пастки қисмига ўтган. Оғриқ доимий, кучайиб бормоқда. 2 марта қусган, иситма 38.2°C.",
        history: "Олдин аппендицит бўлмаган."
      }
    },
    {
      name: "Бронхиал астма ҳужуми",
      description: "Ўткир нафас қисилиши, хиррилаш, нафас олиш қийинлашиши",
      data: {
        age: "29",
        gender: 'female',
        complaints: "Бугун эрталабдан бошлаб нафас олиш қийинлашди, хиррилаш пайдо бўлди. Салбутамол инҳаляцияси вақтинчалик ёрдам берди. Ҳозир нафас олиш жуда қийин, гапиришга куч етмаяпти.",
        history: "Бронхиал астма 10 йил. Сўнгги ойда тез-тез ҳужумлар бўлмоқда.",
        currentMedications: "Салбутамол инҳалятори, беклометазон."
      }
    }
  ],
  'ru': [
    {
      name: "Инфаркт миокарда (подозрение)",
      description: "Сильная боль в груди, одышка, холодный пот",
      data: {
        age: "62",
        gender: 'male',
        complaints: "Внезапно началась сдавливающая, давящая боль в центре грудной клетки. Боль отдаёт в левую руку и челюсть. Холодный пот, одышка и страх смерти. Боль длится около 20 минут, нитроглицерин не помогает.",
        history: "Гипертония 10 лет, принимает лекарства нерегулярно. Сахарный диабет 2 типа. Курит (1.5 пачки в день).",
        familyHistory: "Отец перенёс инфаркт миокарда в 55 лет."
      }
    },
    {
      name: "Ишемический инсульт (подозрение)",
      description: "Асимметрия лица, нарушение речи, слабость в руке/ноге",
      data: {
        age: "71",
        gender: 'female',
        complaints: "Примерно час назад внезапно нарушилась речь, появилась слабость в правой руке и ноге. Правый уголок рта опущен. С трудом отвечает на вопросы. Головной боли и рвоты нет.",
        history: "Фибрилляция предсердий, принимает антикоагулянты нерегулярно. Гипертония.",
        currentMedications: "Верапамил, время от времени варфарин.",
      }
    },
    {
      name: "Анафилактический шок (подозрение)",
      description: "Внезапная одышка, сыпь, падение давления",
      data: {
        age: "34",
        gender: 'female',
        complaints: "Через 5 минут после укуса неизвестного насекомого появилась красная сыпь по всему телу, одышка, хрипы, головокружение и сильная слабость. Чувствует сдавление в горле.",
        allergies: "Аллергия на пенициллин.",
        objectiveData: "Кожные покровы красные, отёчные. Дыхание шумное. АД 80/50 мм рт.ст. ЧСС 130/мин."
      }
    },
    {
      name: "Острая сердечная недостаточность",
      description: "Сердечная недостаточность, острая одышка, отёки ног",
      data: {
        age: "68",
        gender: 'male',
        complaints: "3 дня затруднённое дыхание, особенно в положении лёжа. Правая нога и стопа отекли. При кашле выделяется мокрота синего цвета. Ночью просыпается от одышки.",
        history: "Сердечная недостаточность 3 года, гипертония 15 лет. Ранее перенёс инфаркт миокарда.",
        currentMedications: "Фуросемид, спиронолактон, эналаприл."
      }
    },
    {
      name: "Острый панкреатит",
      description: "Сильная боль в верхней части живота, рвота",
      data: {
        age: "45",
        gender: 'male',
        complaints: "После плотного ужина в верхней части живота, особенно слева, началась сильная боль. Боль отдаёт в спину. Рвала 5 раз, боль не уменьшается.",
        history: "Желчнокаменная болезнь, 2 года назад удалена желчный пузырь. Регулярно употребляет алкоголь.",
        objectiveData: "Живот сильно болезненный, мышцы напряжены. При глубоком надавливании в верхней части живота боль усиливается."
      }
    },
    {
      name: "Гипергликемический гиперосмолярный синдром",
      description: "Осложнение сахарного диабета, тяжелое обезвоживание",
      data: {
        age: "58",
        gender: 'female',
        complaints: "5 дней сильная жажда, частое мочеиспускание, головная боль и нарушение зрения. 2 дня много спит, но чувствует слабость. Дыхание учащенное.",
        history: "Сахарный диабет 2 типа 12 лет, инсулин не принимает. В последние недели прекратил принимать лекарства.",
        objectiveData: "Кожа и слизистые сухие. Дыхание глубокое и частое. АД 90/60."
      }
    },
    {
      name: "Острый аппендицит",
      description: "Боль в правом нижнем квадранте живота, лихорадка",
      data: {
        age: "24",
        gender: 'male',
        complaints: "Вчера началась боль в центре живота, сегодня перешла в правый нижний квадрант. Боль постоянная, усиливается. Рвота 2 раза, температура 38.2°C.",
        history: "Ранее аппендицита не было."
      }
    },
    {
      name: "Приступ бронхиальной астмы",
      description: "Острая одышка, хрипы, затруднение дыхания",
      data: {
        age: "29",
        gender: 'female',
        complaints: "С сегодняшнего утра затруднено дыхание, появились хрипы. Ингаляция сальбутамола временно помогла. Сейчас дышать очень трудно, не хватает сил говорить.",
        history: "Бронхиальная астма 10 лет. В последний месяц частые приступы.",
        currentMedications: "Ингалятор сальбутамола, беклометазон."
      }
    }
  ],
  'en': [
    {
      name: "Myocardial Infarction (suspected)",
      description: "Severe chest pain, shortness of breath, cold sweats",
      data: {
        age: "62",
        gender: 'male',
        complaints: "Sudden onset of squeezing, pressing pain in the center of the chest. Pain radiates to left arm and jaw. Cold sweats, shortness of breath, and fear of death. Pain has lasted about 20 minutes, nitroglycerin is not helping.",
        history: "Hypertension for 10 years, takes medication irregularly. Type 2 diabetes. Smokes (1.5 packs per day).",
        familyHistory: "Father had myocardial infarction at age 55."
      }
    },
    {
      name: "Ischemic Stroke (suspected)",
      description: "Facial asymmetry, speech impairment, limb weakness",
      data: {
        age: "71",
        gender: 'female',
        complaints: "About an hour ago, sudden speech impairment appeared, weakness in right hand and leg. Right corner of mouth is drooping. Has difficulty answering questions. No headache or vomiting.",
        history: "Atrial fibrillation, takes anticoagulants irregularly. Hypertension.",
        currentMedications: "Verapamil, occasionally warfarin.",
      }
    },
    {
      name: "Anaphylactic Shock (suspected)",
      description: "Sudden breathing difficulty, rash, low blood pressure",
      data: {
        age: "34",
        gender: 'female',
        complaints: "5 minutes after an unknown insect bite, red rash appeared all over body, shortness of breath, wheezing, dizziness and severe weakness. Feels constriction in throat.",
        allergies: "Allergy to penicillin.",
        objectiveData: "Skin is red and swollen. Breathing is noisy. BP 80/50 mmHg. HR 130/min."
      }
    },
    {
      name: "Acute Heart Failure",
      description: "Heart failure, acute shortness of breath, leg swelling",
      data: {
        age: "68",
        gender: 'male',
        complaints: "For 3 days, difficulty breathing, especially when lying down. Right leg and foot are swollen. When coughing, produces blue-colored sputum. Wakes up at night due to shortness of breath.",
        history: "Heart failure for 3 years, hypertension for 15 years. Previously had myocardial infarction.",
        currentMedications: "Furosemide, spironolactone, enalapril."
      }
    },
    {
      name: "Acute Pancreatitis",
      description: "Severe upper abdominal pain, vomiting",
      data: {
        age: "45",
        gender: 'male',
        complaints: "After a heavy dinner, severe pain started in upper abdomen, especially on the left side. Pain radiates to back. Vomited 5 times, pain is not subsiding.",
        history: "Gallstone disease, gallbladder removed 2 years ago. Regularly consumes alcohol.",
        objectiveData: "Abdomen is very painful, muscles are tense. Pain intensifies with deep pressure in upper abdomen."
      }
    },
    {
      name: "Hyperglycemic Hyperosmolar State",
      description: "Diabetes complication, severe dehydration",
      data: {
        age: "58",
        gender: 'female',
        complaints: "For 5 days, severe thirst, frequent urination, headache and vision disturbance. For 2 days, sleeping a lot but feeling weak. Breathing is rapid.",
        history: "Type 2 diabetes for 12 years, not on insulin. Stopped taking medications in recent weeks.",
        objectiveData: "Skin and mucous membranes are dry. Breathing is deep and rapid. BP 90/60."
      }
    },
    {
      name: "Acute Appendicitis",
      description: "Pain in right lower quadrant, fever",
      data: {
        age: "24",
        gender: 'male',
        complaints: "Yesterday pain started in center of abdomen, today moved to right lower quadrant. Pain is constant and worsening. Vomited 2 times, fever 38.2°C.",
        history: "No previous appendicitis."
      }
    },
    {
      name: "Bronchial Asthma Attack",
      description: "Acute shortness of breath, wheezing, breathing difficulty",
      data: {
        age: "29",
        gender: 'female',
        complaints: "Since this morning, breathing has become difficult, wheezing appeared. Salbutamol inhalation provided temporary relief. Now breathing is very difficult, not enough strength to speak.",
        history: "Bronchial asthma for 10 years. Frequent attacks in the last month.",
        currentMedications: "Salbutamol inhaler, beclomethasone."
      }
    }
  ],
  'kaa': [
    {
      name: "Miyokard Infarkti (paydalaw)",
      description: "Kókrak qafasindaǵı kúshli awırıq, dem alw qıyınlığı, sowıq ter",
      data: {
        age: "62",
        gender: 'male',
        complaints: "Tósatdan baslangan, kókrak qafasınıń ortasında sıqıwshı, basıwshı awırıq. Awırıq sol qolǵa hám jawǵa tarqalmaqta. Sowıq ter basıwı, hansıraw hám ólim qorqınıwı. Awırıq taxminan 20 minut dawam etmekte, nitrogliserin tásiri joq.",
        history: "10 jıldan beri gipertoniya keselliqi, muntazam dári ishpeydi. Qandlı diabet 2-tur. Shekedi (kúnine 1.5 qutı).",
        familyHistory: "Atasında 55 jasında miyokard infarkti bolǵan."
      }
    },
    {
      name: "Ishemik insult (paydalaw)",
      description: "Bet asimmetriyası, sóz búzilisi, qol/ayaqta ájizlik",
      data: {
        age: "71",
        gender: 'female',
        complaints: "Taxminan 1 saat burın tósatdan sózi búzılǵan, on qolı hám ayağında ájizlik payda bolǵan. Betiniń on burchagı asılıp qalǵan. Sorawlarga juwap beriwge qıynalmaqta. Bas awırığı hám qusiw joq.",
        history: "Atrial fibrillatsiya, antikoagulyantlardı nemuntazam qabıl qaladı. Gipertoniya.",
        currentMedications: "Verapamil, waqtı-waqtı menen warfarin.",
      }
    },
    {
      name: "Anafilaktik shok (paydalaw)",
      description: "Tósatdan dem alw qıyınlığı, búdırlar, qan basımı túsiwi",
      data: {
        age: "34",
        gender: 'female',
        complaints: "Belgisiz hasharot shaqıwınan 5 minut ótgennen soń, bútken denede qızıl búdırlar shıqtı, hansıraw, xırıllaw, bas aylanıwı hám kúshli árimsizlik payda boldı. Tamagı qısılawın sezmekte.",
        allergies: "Penitsillinge allergiya bar.",
        objectiveData: "Teri qaplamaları qızarǵan, isigen. Dem alw shovınlı. Qan basımı 80/50 mm.sim.ust. Júrek urıw jıllığı 130/min."
      }
    },
    {
      name: "Júrek yetispewshiligi",
      description: "Júrek yetispewshiligi, jiddiy dem alw qıyınlığı, ayaqtarda isik",
      data: {
        age: "68",
        gender: 'male',
        complaints: "3 kún dawamında dem alw qıyınlaşıp barmaqta, árnay jatqanda. On ayaq hám ayağı isip ketken. Kekirgende kók jele kórinisinde balǵam shıǵadı. Túnde dem alw qıyınlıǵı menen oyğanadı.",
        history: "Júrek yetispewshiligi 3 jıl, gipertoniya 15 jıl. Ilgeri miyokard infarkti bolǵan.",
        currentMedications: "Furosemid, spironolakton, enalapril."
      }
    },
    {
      name: "Jiddiy pankreatit",
      description: "Qorınıń joqarı bóleginde kúshli awırıq, qusıw",
      data: {
        age: "45",
        gender: 'male',
        complaints: "Keshqurın toıb jegennen soń qorınıń joqarı bóleginde, árnay sol tomonda kúshli awırıq baslanǵan. Awırıq arqaǵa taralmaqta. 5 ret qusqan, awırıq kemeymeydi.",
        history: "Ót tas keselliqi, 2 jıl burın ót qopı operatsiyası qılıngan. Muntazam araq isheydi.",
        objectiveData: "Qorın kúshli awırıqlı, búyirler kúshli kúyewli. Qorınıń joqarı bóleginde terenlegen basqanda awırıq kúshleydi."
      }
    },
    {
      name: "Giperglikemiyalıq giperosmolyar jaǵday",
      description: "Qandlı diabet asqınaması, awır suwsızlanıw",
      data: {
        age: "58",
        gender: 'female',
        complaints: "5 kún dawamında kúshli şawğalıq, kóp siydik shıǵıw, bas awırığı hám kóriwdiń búzilisi. 2 kún kóp uxlamaqta, biraq árimsiz. Dem alw tezlegen.",
        history: "Qandlı diabet 2-tur 12 jıl, insulin almaydı. Sońǵı heftalarda dari ishewdi toqtatqan.",
        objectiveData: "Teri hám slimıq qaplamaları qurıq. Dem alw teren hám tez. Qan basımı 90/60."
      }
    },
    {
      name: "Jiddiy appenditsit",
      description: "Qorınıń on tomandıǵında awırıq, qızba",
      data: {
        age: "24",
        gender: 'male',
        complaints: "Keshe qorın ortasında awırıq baslanǵan, búgin on tomandıǵına ótti. Awırıq uzaqtı, kúshlenip barmaqta. 2 ret qusqan, qızba 38.2°C.",
        history: "Aldın appenditsit bolmaǵan."
      }
    },
    {
      name: "Bronxial astma hujımı",
      description: "Jiddiy dem alw qıyınlığı, xırıllaw, dem alw qıyınlaşıwı",
      data: {
        age: "29",
        gender: 'female',
        complaints: "Búgin tangerten baslap dem alw qıyınlaştı, xırıllaw payda boldı. Salbutamol ingalyatsiyası waqtınsha járdem berdi. Házir dem alw áte qıyın, sóylewge kúsh jetpeymekte.",
        history: "Bronxial astma 10 jıl. Sońǵı ayda tez-tez hujımlar bolmaqta.",
        currentMedications: "Salbutamol ingalyatorı, beklometazon."
      }
    }
  ]
};

// Export function to get templates by language
export function getEmergencyTemplates(language: Language): EmergencyTemplate[] {
  return templatesByLanguage[language] || templatesByLanguage['uz-L'];
}

// Keep default export for backward compatibility
export const emergencyTemplates = templatesByLanguage['uz-L'];