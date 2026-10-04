// Comprehensive list of major Ghana towns and cities
// Assin towns prioritized first, then Central Region, then others
export const GHANA_TOWNS = [
  // Assin District (Central Region) - PRIORITY
  'Assin Foso',
  'Assin Fosu',
  'Assin Manso',
  'Assin North',
  'Assin South',

  // Central Region (other than Assin)
  'Cape Coast',
  'Takoradi',
  'Sekondi',
  'Elmina',
  'Winneba',
  'Agona Swedru',
  'Kasoa',
  'Twifo Priso',
  'Dunkwa-on-Offin',
  'Awutu Senya',
  'Gomoa Fetteh',
  'Saltpond',
  'Moree',
  'Shama',
  'Half Assini',
  'Apam',
  'Mumford',

  // Greater Accra Region
  'Accra',
  'Tema',
  'Adenta',
  'Spintex',
  'Osu',
  'Makola',
  'Labadi',
  'Teshie',
  'Nungua',
  'Lartebiokorshie',
  'Ashaiman',
  'Ashiaman',
  'Suhum',
  'Gomoa Buduburam',

  // Western Region
  'Kumasi',
  'Sekondi-Takoradi',
  'Sefwi Wiawso',
  'Sefwi Asokwa',
  'Mampong',
  'Offinso',
  'Kumawu',
  'Ejisu',
  'Adum',
  'Konongo',
  'Obuasi',
  'Ashanti Mampong',

  // Ashanti Region
  'Ashanti',
  'Kwadum',
  'Techiman',
  'Sunyani',
  'Duayaw Nkwanta',
  'Berekum',
  'New Edubiase',
  'Juansa',
  'Atonsu',

  // Eastern Region
  'Koforidua',
  'Asamando',
  'Akropong',
  'Juaso',
  'Abetifi',
  'Suhum',
  'Nsawam',
  'Kibi',
  'Oda',
  'Begoro',
  'Asesewa',

  // Northern Region
  'Tamale',
  'Savelugu',
  'Yendi',
  'Karaga',
  'Bawku',
  'Bolgatanga',
  'Navrongo',
  'Gowrie',
  'Zabzugu',
  'Walewale',

  // Upper East Region
  'Bolgatanga',
  'Navrongo',
  'Bawku',
  'Bawfiagu',
  'Kandiga',
  'Paglo',
  'Garu',
  'Zebilla',

  // Upper West Region
  'Wa',
  'Lawra',
  'Nandom',
  'Hamile',
  'Kaleo',
  'Issa',
  'Jirapa',

  // Volta Region
  'Ho',
  'Keta',
  'Aflao',
  'Denu',
  'Dzodze',
  'Keta Station',
  'Sogakope',
  'Hohoe',
  'Kpandu',
  'Jasikan',
  'Ashanti Mampong',

  // Northern Region (continued)
  'Gushegu',
  'Tatale',
  'Nalerigu',
  'Gambaga',
  'Damongo',
  'Buipe',
  'Larabanga',
]

// Helper function to get Ghana towns sorted by priority
export function getSortedGhanaTowns(): string[] {
  // Deduplicate while preserving Assin priority
  const seenLower = new Set<string>()
  const result: string[] = []

  for (const town of GHANA_TOWNS) {
    const lower = town.toLowerCase()
    if (!seenLower.has(lower)) {
      seenLower.add(lower)
      result.push(town)
    }
  }

  return result
}
