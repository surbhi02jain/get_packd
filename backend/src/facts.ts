// "Did you know?" facts per destination, shown on trip pages and on the Spin the globe result.
// Hand-written for the destinations that have trips, keeping to well-documented facts (dates, records, UNESCO listings)
// rather than trivia that can't be checked. A destination missing here shows no facts.

export const FACTS: Record<string, string[]> = {
  uttarakhand: [
    "The Ganga begins at Gaumukh, the snout of the Gangotri Glacier, nearly 4,000 m up in Uttarakhand.",
    "The Valley of Flowers and Nanda Devi national parks together form a UNESCO World Heritage Site.",
    "Rishikesh became world-famous in 1968, when the Beatles came to study meditation at Maharishi Mahesh Yogi's ashram.",
  ],
  himachal: [
    "Shimla was the summer capital of British India; for months each year, the empire was run from these hills.",
    "The Kalka–Shimla railway, opened in 1903, is part of the UNESCO-listed Mountain Railways of India.",
    "McLeodganj, above Dharamshala, has been home to the Dalai Lama and the Tibetan government-in-exile since 1960.",
  ],
  karnataka: [
    "Hampi was the capital of the Vijayanagara Empire and, around 1500, one of the largest cities in the world.",
    "Legend says coffee came to India when the saint Baba Budan carried seven beans from Yemen to the Chikmagalur hills in the 1600s.",
    "The Gommateshwara statue at Shravanabelagola, carved from a single rock around 983 CE, stands about 17 metres tall.",
  ],
  meghalaya: [
    "Mawsynram and nearby Cherrapunji are counted among the wettest places on Earth.",
    "Khasi villagers grow living root bridges by training the roots of rubber fig trees across streams; some have stood for centuries.",
    "Mawlynnong was named Asia's cleanest village by a travel magazine in 2003.",
  ],
  vietnam: [
    "Ha Long Bay has around 1,600 limestone islands and islets, and is a UNESCO World Heritage Site.",
    "Son Doong in Phong Nha is the world's largest known cave passage; it was only explored properly in 2009.",
    "Vietnam is the world's second-biggest coffee producer, after Brazil.",
  ],
  kerala: [
    "Vasco da Gama landed at Kappad near Kozhikode in 1498, opening the sea route from Europe to India.",
    "Kerala's backwaters are a web of about 900 km of canals, rivers and lakes.",
    "Kochi's Chinese fishing nets are believed to have come with traders from the court of Kublai Khan.",
  ],
  srilanka: [
    "Sigiriya is a 5th-century royal citadel built on top of a rock about 180 metres high.",
    "Sri Lanka turned to tea after coffee rust wiped out its coffee plantations in the 1870s.",
    "The sacred Bodhi tree at Anuradhapura, grown from a cutting of the Buddha's tree, was planted in 288 BCE: the oldest human-planted tree with a known date.",
  ],
  northeast: [
    "Tawang Monastery in Arunachal is the largest monastery in India; the 6th Dalai Lama was born nearby in 1683.",
    "Majuli, in the Brahmaputra, is one of the largest river islands in the world.",
    "Nagaland's Hornbill Festival brings all its major tribes together at Kisama every year from 1 to 10 December.",
  ],
  bali: [
    "Bali is the only Hindu-majority province in Muslim-majority Indonesia.",
    "On Nyepi, the Balinese day of silence, the whole island shuts down for 24 hours; even the airport closes.",
    "Bali's subak system of rice terraces and water temples dates back to the 9th century and is a UNESCO World Heritage Site.",
  ],
  rajasthan: [
    "Jaisalmer Fort is a 'living fort': thousands of people still live inside its 12th-century walls.",
    "Jaipur was painted pink in 1876 to welcome the Prince of Wales.",
    "Six of Rajasthan's hill forts are a UNESCO World Heritage Site; Kumbhalgarh's wall runs for about 36 km.",
  ],
  spiti: [
    "Key Monastery, above the Spiti river, was founded about a thousand years ago.",
    "Marine fossils are found around Langza at over 4,000 m, because this land once lay under the ancient Tethys Sea.",
    "Komic, at about 4,500 m, is among the highest villages in the world reachable by road.",
  ],
  maharashtra: [
    "The paintings in the Ajanta caves go back as far as the 2nd century BCE.",
    "Twelve Maratha forts, most of them in the Sahyadris, became a UNESCO World Heritage Site in 2025.",
    "Mumbai was once seven separate islands, joined by land reclamation between the 17th and 19th centuries.",
  ],
  japan: [
    "The Shinkansen bullet train has run since 1964 without a single passenger killed in a crash.",
    "Kyoto's UNESCO World Heritage listing covers 17 temples, shrines and castles, and the city has over 1,600 temples in all.",
    "Mount Fuji last erupted in 1707.",
  ],
  thailand: [
    "Thailand is the only country in Southeast Asia never colonised by a European power.",
    "Bangkok's full ceremonial name has 168 letters, one of the longest place names in the world.",
    "The Full Moon Party on Ko Pha Ngan began in the 1980s as a small gathering on Haad Rin beach.",
  ],
  bhutan: [
    "Bhutan measures progress by Gross National Happiness, an idea its fourth king put forward in the 1970s.",
    "Bhutan is carbon negative: its forests absorb more carbon dioxide than the country emits.",
    "Gangkhar Puensum, at 7,570 m, is the highest unclimbed mountain in the world; Bhutan bans climbing its high peaks.",
  ],
  europe: [
    "The Schengen Agreement, which lets you cross most of Europe on one visa, was signed in 1985 in the village of Schengen, Luxembourg.",
    "Vatican City is the world's smallest country, at about 0.44 square kilometres.",
    "The Eiffel Tower was meant to stand for only 20 years after the 1889 World's Fair.",
  ],
  kashmir: [
    "Dal Lake's houseboats began in British times, when outsiders couldn't own land in Kashmir, so they built on the water instead.",
    "Kashmir is one of the few places in the world where saffron is grown, around Pampore.",
    "Srinagar's Shalimar Bagh was laid out by the Mughal emperor Jahangir in 1619.",
  ],
  goa: [
    "Goa was a Portuguese colony for about 450 years, until 1961.",
    "The body of St Francis Xavier has lain in the Basilica of Bom Jesus, a UNESCO World Heritage Site, since the 1600s.",
    "Goa is India's smallest state by area.",
  ],
  andaman: [
    "The Andamans are home to the Sentinelese, among the last uncontacted peoples on Earth; going near North Sentinel Island is banned.",
    "Barren Island, east of Port Blair, has the only confirmed active volcano in South Asia.",
    "Port Blair's Cellular Jail held Indian freedom fighters, including V. D. Savarkar.",
  ],
  nepal: [
    "Eight of the world's ten highest mountains, Everest included, are in Nepal.",
    "Lumbini in southern Nepal is where the Buddha was born.",
    "Nepal's flag is the only national flag in the world that isn't a rectangle.",
  ],
  georgia: [
    "Georgia has made wine for about 8,000 years, fermenting it in clay jars called qvevri buried underground.",
    "Georgia's own alphabet, used nowhere else, is listed by UNESCO as living heritage.",
    "Ushguli in Svaneti is one of the highest permanently inhabited villages in Europe.",
  ],
  uttarpradesh: [
    "Varanasi is one of the oldest continuously inhabited cities in the world.",
    "Sarnath, just outside Varanasi, is where the Buddha gave his first sermon.",
    "The Taj Mahal took about 22 years and some 20,000 workers to build.",
  ],
  kazakhstan: [
    "Kazakhstan is the largest landlocked country in the world.",
    "Yuri Gagarin's flight in 1961, the first human trip to space, launched from Baikonur in Kazakhstan.",
    "Wild apples first grew in the mountains around Almaty, the ancestors of every apple we eat today.",
  ],
  ladakh: [
    "Pangong Tso is about 134 km long, and roughly 60% of it lies in Tibet.",
    "Hemis Monastery unveils its giant thangka of Padmasambhava only once every 12 years.",
    "Ladakh gets so little rain that it's often called a cold desert.",
  ],
  sikkim: [
    "Kangchenjunga, the world's third-highest mountain, sits on Sikkim's border and is worshipped as a guardian deity.",
    "Sikkim was an independent kingdom until it became India's 22nd state in 1975.",
    "Sikkim became India's first fully organic state in 2016.",
  ],
  tamilnadu: [
    "Thanjavur's Brihadisvara Temple, finished in 1010 CE, has a tower about 66 metres tall.",
    "The Nilgiri Mountain Railway up to Ooty is a UNESCO World Heritage Site and still climbs on a rack-and-pinion track.",
    "Pondicherry stayed French until 1954, and many of its street signs are still in French.",
  ],
  nordics: [
    "In northern Finnish Lapland the sun doesn't rise at all for weeks in winter, a time called kaamos.",
    "Finland has about 188,000 lakes.",
    "Norway's Lærdal Tunnel, at 24.5 km, is the longest road tunnel in the world.",
  ],
  gujarat: [
    "The Statue of Unity, at 182 metres, is the tallest statue in the world.",
    "Gir is the only place in the world where Asiatic lions live in the wild.",
    "Dholavira, a Harappan city in the Rann of Kutch, became a UNESCO World Heritage Site in 2021.",
  ],
  madhyapradesh: [
    "Khajuraho's temples were built by the Chandela kings between about 950 and 1050 CE.",
    "The Great Stupa at Sanchi was first built under Emperor Ashoka in the 3rd century BCE.",
    "The Bhimbetka rock shelters hold paintings thousands of years old, some from the Stone Age.",
  ],
  andhra: [
    "The Tirumala Venkateswara Temple is one of the most visited places of worship in the world.",
    "Araku Valley coffee is grown by tribal farmers in the Eastern Ghats and has won international awards.",
  ],
  eastindia: [
    "Odisha's Konark Sun Temple is carved as a giant stone chariot with 24 wheels.",
    "The Sundarbans, shared by Bengal and Bangladesh, is the largest mangrove forest in the world and home to the Bengal tiger.",
    "The Darjeeling Himalayan Railway's 'toy train' has run since 1881 and is a UNESCO World Heritage Site.",
  ],
  switzerland: [
    "Switzerland has four national languages: German, French, Italian and Romansh.",
    "Jungfraujoch, at 3,454 m, is the highest railway station in Europe.",
    "The Gotthard Base Tunnel, at 57 km, is the longest railway tunnel in the world.",
  ],
  lakshadweep: [
    "Lakshadweep means 'a hundred thousand islands', but it has 36, and only 10 are inhabited.",
    "Lakshadweep is India's smallest union territory.",
  ],
  kenya: [
    "Each year more than a million wildebeest cross between Tanzania's Serengeti and Kenya's Maasai Mara in the Great Migration.",
    "Kenya is named after Mount Kenya, Africa's second-highest mountain.",
    "The equator runs through Kenya, so at Nanyuki you can stand in both hemispheres at once.",
  ],
  mauritius: [
    "Mauritius was the only home of the dodo, which was gone by the late 1600s.",
    "Chamarel's Seven Coloured Earths are dunes of seven distinct colours of sand.",
    "About two-thirds of Mauritians have Indian roots, many descended from workers brought over in the 1800s.",
  ],
  punjab: [
    "The Golden Temple's langar serves free meals to tens of thousands of people every day.",
    "The flag-lowering ceremony at the Attari–Wagah border has been held every evening since 1959.",
  ],
  egypt: [
    "The Great Pyramid of Giza was the tallest structure made by humans for nearly 4,000 years.",
    "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
    "In the 1960s, the Abu Simbel temples were cut into blocks and moved 65 metres uphill to save them from Lake Nasser.",
  ],
  dubai: [
    "The Burj Khalifa, at 828 metres, is the tallest building in the world.",
    "Palm Jumeirah was built from about 94 million cubic metres of sand dredged from the sea.",
  ],
  singapore: [
    "Singapore is one of only three city-states left in the world, with Monaco and Vatican City.",
    "The Supertrees at Gardens by the Bay are vertical gardens up to 50 metres tall.",
  ],
  korea: [
    "Hangul, the Korean alphabet, was created in 1443 under King Sejong.",
    "In 2023 South Korea switched to counting age the international way; before that, babies were one year old at birth.",
  ],
  russia: [
    "The Trans-Siberian Railway, about 9,289 km from Moscow to Vladivostok, is the longest railway line in the world.",
    "Lake Baikal holds about a fifth of the world's unfrozen fresh surface water.",
    "Russia spans 11 time zones.",
  ],
  chhattisgarh: [
    "Chitrakote Falls on the Indravati river is the widest waterfall in India, often called India's Niagara.",
  ],
  cambodia: [
    "Angkor Wat is the largest religious monument in the world.",
    "Angkor Wat was built in the 12th century as a Hindu temple to Vishnu, and later became Buddhist.",
  ],
  hongkong: [
    "Hong Kong has more skyscrapers than any other city in the world.",
    "Hong Kong was a British colony for over 150 years, until its handover to China in 1997.",
  ],
  iceland: [
    "Iceland's parliament, the Althing, was founded in 930 and is one of the oldest in the world.",
    "Almost all of Iceland's electricity comes from geothermal and hydro power.",
  ],
  uzbekistan: [
    "Samarkand is more than 2,700 years old and was one of the great cities of the Silk Road.",
    "The three madrasas of Samarkand's Registan square were built between the 15th and 17th centuries.",
  ],
};

export const factsFor = (slug: string | null | undefined) => (slug ? FACTS[slug] ?? [] : []);
