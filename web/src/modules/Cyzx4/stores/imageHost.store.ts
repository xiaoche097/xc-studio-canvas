import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeLocalStorageStateStorage } from '../utils/safe-storage';

export type ImageHostProvider = 'none' | 'imgbb' | 'custom'; // cspell:disable-line

interface CustomConfig {
  uploadUrl: string;
  method: 'POST' | 'PUT';
  fileParamName: string;
  apiKeyParamName: string;
  apiKeyHeaderName: string;
  apiKey: string;
  responsePath: string; // e.g., "data.url"
}

interface ImageHostState {
  selectedProvider: ImageHostProvider;
  imgbbKey: string; // cspell:disable-line
  customConfig: CustomConfig;
  
  actions: {
    setSelectedProvider: (provider: ImageHostProvider) => void;
    setImgbbKey: (key: string) => void; // cspell:disable-line
    setCustomConfig: (config: Partial<CustomConfig>) => void;
  };
}

export const useImageHostStore = create<ImageHostState>()(
  persist(
    (set) => ({
      selectedProvider: 'none',
      imgbbKey: '', // cspell:disable-line
      customConfig: {
        uploadUrl: '',
        method: 'POST',
        fileParamName: 'image',
        apiKeyParamName: 'key',
        apiKeyHeaderName: '',
        apiKey: '',
        responsePath: 'data.url',
      },

      actions: {
        setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
        setImgbbKey: (imgbbKey) => set({ imgbbKey }), // cspell:disable-line
        setCustomConfig: (updates) => 
          set((state) => ({ 
            customConfig: { ...state.customConfig, ...updates } 
          })),
      },
    }),
    {
      name: 'image-host-storage',
      storage: createJSONStorage(() => safeLocalStorageStateStorage),
      partialize: (state) => ({ // cspell:disable-line
        selectedProvider: state.selectedProvider,
        imgbbKey: state.imgbbKey, // cspell:disable-line
        customConfig: state.customConfig,
      }),
    }
  )
);
