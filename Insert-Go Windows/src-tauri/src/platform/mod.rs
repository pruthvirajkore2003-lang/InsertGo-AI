//! Platform-specific integration (Windows-first). Kept thin and behind small
//! wrappers so v2 can swap implementations for macOS/Linux (SPEC §0, §6.2).

pub mod bounds;
pub mod clipboard;
pub mod foreground;
pub mod hotkey;
pub mod improve;
pub mod permissions;
pub mod selection;
pub mod selection_floater;
pub mod selection_watch;
pub mod skillbar_window;
pub mod text_provider;
pub mod tray;
pub mod window;
