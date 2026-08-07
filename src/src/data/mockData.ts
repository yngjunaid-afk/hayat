export type ShelfItem = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
};

export type SongItem = {
  id: string;
  title: string;
  artist: string;
  subtitle?: string;
  thumbnail?: string;
  album?: string;
  duration?: number;
  language?: string;
  year?: string;
};

export const featuredShelves: ShelfItem[] = [
  {
    id: "1",
    title: "Made for You",
    subtitle: "Personal mixes based on your taste",
    accent: "#A00000",
  },
  {
    id: "2",
    title: "Late Night Glow",
    subtitle: "Soft tracks for calm evenings",
    accent: "#C35B3A",
  },
  {
    id: "3",
    title: "Desi Chill",
    subtitle: "Slow, warm, and easy to replay",
    accent: "#8A3FFC",
  },
];

export const trendingSongs: SongItem[] = [
  {
    id: "1",
    title: "Starboy",
    artist: "The Weeknd",
    thumbnail: "https://i.ytimg.com/vi/34Na4jtmTPg/maxresdefault.jpg",
    album: "Starboy",
    duration: 230,
    year: "2016"
  },
  {
    id: "2",
    title: "Baraat",
    artist: "Armaan Malik",
    thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
    album: "Baraat",
    duration: 210,
    year: "2020"
  },
  {
    id: "3",
    title: "Levitating",
    artist: "Dua Lipa",
    thumbnail: "https://i.ytimg.com/vi/TUVcZfQe-Kw/maxresdefault.jpg",
    album: "Future Nostalgia",
    duration: 203,
    year: "2020"
  },
  {
    id: "4",
    title: "Teri Jhuki Nazar",
    artist: "Pritam",
    thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/maxresdefault.jpg",
    album: "Murder 2",
    duration: 245,
    year: "2011"
  }
];

export const recentlyPlayedSongs: SongItem[] = [
  {
    id: "5",
    title: "After Hours",
    artist: "The Weeknd",
    thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
    album: "After Hours",
    duration: 354,
    year: "2020"
  },
  {
    id: "6",
    title: "Phir Le Aaya Dil",
    artist: "Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/maxresdefault.jpg",
    album: "Aashiqui 2",
    duration: 267,
    year: "2013"
  },
  {
    id: "7",
    title: "Blinding Lights",
    artist: "The Weeknd",
    thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
    album: "After Hours",
    duration: 200,
    year: "2020"
  },
  {
    id: "8",
    title: "Perfect",
    artist: "Ed Sheeran",
    thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/maxresdefault.jpg",
    album: "Divide",
    duration: 263,
    year: "2017"
  }
];

export const madeForYouSongs: SongItem[] = [
  {
    id: "9",
    title: "Sweater Weather",
    artist: "The Neighbourhood",
    thumbnail: "https://i.ytimg.com/vi/DG57kR4QPug/maxresdefault.jpg",
    album: "I Love You.",
    duration: 240,
    year: "2013"
  },
  {
    id: "10",
    title: "Tum Se Hi",
    artist: "Mohit Chauhan",
    thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/maxresdefault.jpg",
    album: "Jab We Met",
    duration: 290,
    year: "2007"
  },
  {
    id: "11",
    title: "Riptide",
    artist: "Vance Joy",
    thumbnail: "https://i.ytimg.com/vi/u6_Fo9eCJC0/maxresdefault.jpg",
    album: "Dream Your Life Away",
    duration: 180,
    year: "2014"
  },
  {
    id: "12",
    title: "Maan Meri Jaan",
    artist: "King",
    thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
    album: "Maan Meri Jaan",
    duration: 210,
    year: "2022"
  }
];