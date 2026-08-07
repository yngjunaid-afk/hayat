export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
  thumbnail: string;
  duration: number;
  audio?: string;
}