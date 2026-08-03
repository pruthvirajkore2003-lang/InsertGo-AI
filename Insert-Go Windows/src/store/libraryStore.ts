/**
 * Saved prompt library. Persistence is delegated to the Rust backend
 * (load/save/delete commands), which is the source of truth — every mutating
 * command returns the full updated list, which we mirror here.
 */
import { create } from "zustand";
import type { Prompt } from "@/types";
import * as bridge from "@/services/tauriBridge";
import { toast } from "@/store/toastStore";

type LibraryState = {
  prompts: Prompt[];
  isLoading: boolean;
  error: string | null;

  load: () => Promise<void>;
  save: (prompt: Prompt) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useLibraryStore = create<LibraryState>((set) => ({
  prompts: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const prompts = await bridge.loadPrompts();
      set({ prompts, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      toast.error(`Couldn't load prompts: ${e}`);
    }
  },

  save: async (prompt) => {
    try {
      const prompts = await bridge.savePrompt(prompt);
      set({ prompts, error: null });
      toast.success("Prompt saved");
    } catch (e) {
      set({ error: String(e) });
      toast.error(`Couldn't save prompt: ${e}`);
    }
  },

  remove: async (id) => {
    try {
      const prompts = await bridge.deletePrompt(id);
      set({ prompts, error: null });
    } catch (e) {
      set({ error: String(e) });
      toast.error(`Couldn't delete prompt: ${e}`);
    }
  },
}));
