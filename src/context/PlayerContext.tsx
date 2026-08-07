import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { SongItem } from "../services/musicApi";
import {
  getPlaybackState,
  playOrToggleTrack,
  seekTo as seekPlaybackTo,
  stopPlayback,
  subscribePlayback,
  togglePlayback,
} from "../services/musicPlayer";

type PlayerSnapshot = {
  track: SongItem | null;
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  error: string | null;
};

export interface PlayerContextType {
  currentSong: SongItem | null;
  isPlaying: boolean;
  loading: boolean;
  error: string | null;
  duration: number;
  position: number;
  toggle: () => Promise<void>;
  play: (song: SongItem) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (positionMillis: number) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType>({
  currentSong: null,
  isPlaying: false,
  loading: false,
  error: null,
  duration: 0,
  position: 0,
  toggle: async () => {},
  play: async () => {},
  pause: async () => {},
  resume: async () => {},
  stop: async () => {},
  seekTo: async () => {},
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(() => {
    const initial = getPlaybackState();
    return {
      track: initial.track,
      isLoading: initial.isLoading,
      isPlaying: initial.isPlaying,
      positionMillis: initial.positionMillis,
      durationMillis: initial.durationMillis,
      error: initial.error,
    };
  });

  useEffect(() => {
    const unsubscribe = subscribePlayback((next) => {
      setSnapshot({
        track: next.track,
        isLoading: next.isLoading,
        isPlaying: next.isPlaying,
        positionMillis: next.positionMillis,
        durationMillis: next.durationMillis,
        error: next.error,
      });
    });

    return unsubscribe;
  }, []);

  const value: PlayerContextType = {
    currentSong: snapshot.track,
    isPlaying: snapshot.isPlaying,
    loading: snapshot.isLoading,
    error: snapshot.error,
    duration: snapshot.durationMillis,
    position: snapshot.positionMillis,
    toggle: async () => {
      await togglePlayback();
    },
    play: async (song: SongItem) => {
      await playOrToggleTrack(song);
    },
    pause: async () => {
      await togglePlayback();
    },
    resume: async () => {
      await togglePlayback();
    },
    stop: async () => {
      await stopPlayback();
    },
    seekTo: async (positionMillis: number) => {
      await seekPlaybackTo(positionMillis);
    },
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  return useContext(PlayerContext);
}