export type HuntItem = {
  id: string; // slug
  title: string;
  category: 'animal' | 'plant' | 'place';
  description: string;
  placeholder: any; // require asset
};

export const HUNT_ITEMS: HuntItem[] = [
  { 
    id: 'condor', 
    title: 'Andean Condor', 
    category: 'animal',
    description: 'The largest flying bird in the world, with a wingspan up to 10 feet. Sacred to the Incas, these magnificent birds soar over the Sacred Valley.',
    placeholder: require('../assets/images/icon.png') 
  },
  { 
    id: 'llama', 
    title: 'Llama', 
    category: 'animal',
    description: 'Domesticated by the Incas over 4,000 years ago, llamas were essential for transportation and wool. Still used by local communities today.',
    placeholder: require('../assets/images/icon.png') 
  },
  { 
    id: 'orchid', 
    title: 'Wild Orchid', 
    category: 'plant',
    description: 'Peru is home to over 3,000 orchid species. The cloud forests around Machu Picchu host many rare and beautiful varieties.',
    placeholder: require('../assets/images/icon.png') 
  },
  { 
    id: 'huayna', 
    title: 'Huayna Picchu', 
    category: 'place',
    description: 'The iconic mountain peak that towers over Machu Picchu. The steep climb offers breathtaking views of the entire citadel below.',
    placeholder: require('../assets/images/icon.png') 
  },
  { 
    id: 'sun-temple', 
    title: 'Temple of the Sun', 
    category: 'place',
    description: 'One of the most sacred structures in Machu Picchu, built with precision-cut stones. Used for astronomical observations and ceremonies.',
    placeholder: require('../assets/images/icon.png') 
  },
  { 
    id: 'terraces', 
    title: 'Inca Terraces', 
    category: 'place',
    description: 'Agricultural terraces that demonstrate Inca engineering genius. Built to prevent erosion and create microclimates for different crops.',
    placeholder: require('../assets/images/icon.png') 
  },
];

