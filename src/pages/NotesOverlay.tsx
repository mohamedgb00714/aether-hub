/**
 * Notes Overlay Page
 * System-wide floating notes widget that appears over all windows
 */

import React, { useEffect, useState, useRef } from 'react';
import { Note } from '../types';
import { db } from '../services/database';
import { 
  PlusIcon, 
  XMarkIcon, 
  ChevronDownIcon,
  ChevronUpIcon,
  BookmarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon
} from '@heroicons/react/24/solid';

const STYLES = [
  { name: 'Sticky Yellow', bg: 'bg-yellow-200', text: 'text-gray-800', bgColor: '#fef08a' },
  { name: 'Soft Blue', bg: 'bg-blue-100', text: 'text-gray-800', bgColor: '#dbeafe' },
  { name: 'Mint Green', bg: 'bg-green-100', text: 'text-gray-800', bgColor: '#dcfce7' },
  { name: 'Lavender', bg: 'bg-purple-100', text: 'text-gray-800', bgColor: '#f3e8ff' },
  { name: 'Rose', bg: 'bg-red-100', text: 'text-gray-800', bgColor: '#fee2e2' },
  { name: 'Dark Mode', bg: 'bg-gray-800', text: 'text-gray-100', bgColor: '#1f2937' },
];

const NotesOverlayPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Load notes
  useEffect(() => {
    loadNotes();
    
    // Make body transparent
    document.body.style.backgroundColor = 'transparent';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';

    console.log('📝 Notes Overlay Page Loaded');
    
    // Listen for notes changes from other windows (main app)
    const unsubscribe = window.electronAPI?.notesOverlay?.onNotesChanged?.(() => {
      console.log('📝 Notes changed from main window, refreshing overlay...');
      loadNotes();
    });
    
    return () => {
      unsubscribe?.();
    };
  }, []);

  // Handle overlay window resizing automatically via ResizeObserver
  useEffect(() => {
    if (!window.electronAPI?.notesOverlay?.resize) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        // Use scrollWidth/Height to get the full content size
        const width = Math.ceil(entry.target.scrollWidth);
        const height = Math.ceil(entry.target.scrollHeight);
        
        if (width > 0 && height > 0) {
          console.log(`📏 Resizing notes overlay: ${width}x${height}`);
          window.electronAPI?.notesOverlay?.resize?.(width, height);
        }
      }
    };

    const observer = new ResizeObserver(handleResize);

    if (containerRef.current) {
      observer.observe(containerRef.current);
      // Immediate trigger for initial size
      const width = Math.ceil(containerRef.current.scrollWidth);
      const height = Math.ceil(containerRef.current.scrollHeight);
      if (width > 0 && height > 0) {
        window.electronAPI?.notesOverlay?.resize?.(width, height);
      }
    }

    return () => observer.disconnect();
  }, [isCollapsed, isExpanded, isEditing, currentNoteIndex, pinnedNotes.length, notes.length]);

  const loadNotes = async () => {
    try {
      const allNotes = await db.notes.getAll();
      const pinned = allNotes.filter(n => n.isPinned);
      const unpinned = allNotes.filter(n => !n.isPinned);
      setPinnedNotes(pinned);
      setNotes(unpinned);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const currentNote = pinnedNotes.length > 0 
    ? pinnedNotes[currentNoteIndex % pinnedNotes.length] 
    : notes[currentNoteIndex % (notes.length || 1)];

  const totalNotes = pinnedNotes.length > 0 ? pinnedNotes.length : notes.length;

  const handlePrevNote = () => {
    setCurrentNoteIndex(prev => (prev - 1 + totalNotes) % totalNotes);
    setIsEditing(false);
  };

  const handleNextNote = () => {
    setCurrentNoteIndex(prev => (prev + 1) % totalNotes);
    setIsEditing(false);
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await db.notes.upsert({
        title: 'Quick Note',
        content: '',
        category: 'Quick',
        isPinned: false,
        style: {
          backgroundColor: 'bg-yellow-200',
          color: '#1f2937',
        },
        position: { x: 0, y: 0 },
      });
      await loadNotes();
      // Broadcast to all windows for instant sync
      window.electronAPI?.notesOverlay?.broadcast?.();
      setCurrentNoteIndex(0);
      setEditTitle('Quick Note');
      setEditContent('');
      setIsEditing(true);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!currentNote) return;
    try {
      await db.notes.upsert({
        ...currentNote,
        title: editTitle,
        content: editContent,
      });
      await loadNotes();
      // Broadcast to all windows for instant sync
      window.electronAPI?.notesOverlay?.broadcast?.();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const handleClose = () => {
    window.electronAPI?.notesOverlay?.hide?.();
  };

  const handleOpenNotesPage = () => {
    window.electronAPI?.notesOverlay?.toMainWindow?.({ type: 'navigate', path: '/notes' });
  };

  const startEditing = () => {
    if (currentNote) {
      setEditTitle(currentNote.title);
      setEditContent(currentNote.content);
      setIsEditing(true);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    // ResizeObserver will handle the window resize automatically
  };

  const currentStyle = currentNote 
    ? STYLES.find(s => s.bg === currentNote.style.backgroundColor) || STYLES[0]
    : STYLES[0];

  // Get the actual background color for inline style (for proper rendering)
  const getActualBgColor = () => {
    if (!currentNote) return currentStyle.bgColor;
    const style = STYLES.find(s => s.bg === currentNote.style.backgroundColor);
    return style?.bgColor || currentStyle.bgColor;
  };

  const getActualTextColor = () => {
    if (!currentNote) return currentStyle.text === 'text-gray-100' ? '#f3f4f6' : '#1f2937';
    const style = STYLES.find(s => s.bg === currentNote.style.backgroundColor);
    return style?.text === 'text-gray-100' ? '#f3f4f6' : '#1f2937';
  };

  // Collapsed state - just a small pill
  if (isCollapsed) {
    return (
      <div 
        ref={containerRef}
        className="w-fit h-fit bg-transparent"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div 
          className="flex items-center gap-2 px-3 py-2 rounded-full shadow-xl cursor-pointer hover:scale-105 transition-transform"
          onClick={() => setIsCollapsed(false)}
          style={{ 
            WebkitAppRegion: 'no-drag',
            backgroundColor: getActualBgColor(),
            color: getActualTextColor(),
          } as React.CSSProperties}
        >
          <BookmarkIcon className="w-4 h-4" />
          <span className="text-xs font-bold">{totalNotes} Notes</span>
          <ChevronUpIcon className="w-3 h-3" />
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-fit h-fit bg-transparent flex flex-col"
    >
      {/* Main Card */}
      <div 
        className={`rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isExpanded ? 'w-[400px] min-h-[400px] max-h-[500px]' : 'w-[280px] min-h-[280px] max-h-[360px]'}`}
        style={{ 
          backgroundColor: getActualBgColor(),
          color: getActualTextColor(),
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        {/* Header - Draggable */}
        <div 
          className="flex items-center justify-between px-3 py-2 border-b border-black/10 shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <BookmarkIcon className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-70">
              Notes ({currentNoteIndex + 1}/{totalNotes || 1})
            </span>
          </div>
          <div 
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button 
              onClick={toggleExpanded}
              className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
              title={isExpanded ? 'Shrink' : 'Expand'}
            >
              {isExpanded ? (
                <ArrowsPointingInIcon className="w-3.5 h-3.5" />
              ) : (
                <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
              )}
            </button>
            <button 
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
              title="Collapse"
            >
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleClose}
              className="p-1.5 rounded-full hover:bg-red-500/20 hover:text-red-600 transition-colors"
              title="Close"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col min-h-0">
          {currentNote ? (
            isEditing ? (
              // Edit Mode
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Note title..."
                  className="w-full bg-white/30 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 shrink-0"
                  autoFocus
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write something..."
                  className="flex-1 w-full bg-white/30 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/50 min-h-0 overflow-y-auto"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleSaveNote}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2 bg-gray-500 text-white rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div 
                className="flex-1 cursor-pointer overflow-y-auto min-h-0"
                onClick={startEditing}
                style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(0,0,0,0.2) transparent'
                }}
              >
                <div className="mb-1 flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-50 bg-black/5 px-2 py-0.5 rounded">
                    {currentNote.category}
                  </span>
                  {currentNote.isPinned && (
                    <BookmarkIcon className="w-3 h-3 text-red-500" />
                  )}
                </div>
                <h3 className="font-bold text-base mb-2 shrink-0">{currentNote.title}</h3>
                <p className={`whitespace-pre-wrap ${isExpanded ? 'text-sm' : 'text-xs'} leading-relaxed opacity-80`}>
                  {currentNote.content || 'Click to edit...'}
                </p>
              </div>
            )
          ) : (
            // No Notes
            <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-60">
              <BookmarkIcon className="w-10 h-10" />
              <p className="text-sm">No notes yet</p>
              <button
                onClick={handleCreateNote}
                className="px-4 py-2 bg-white/30 rounded-lg text-xs font-semibold hover:bg-white/50 transition-colors"
              >
                Create First Note
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-black/10 shrink-0">
          <button
            onClick={handlePrevNote}
            disabled={totalNotes <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/5 hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          
          <div className="flex gap-1">
            <button
              onClick={handleCreateNote}
              className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
              title="New Note"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenNotesPage}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-black/5 hover:bg-black/10 transition-colors"
              title="Open Notes Page"
            >
              All Notes
            </button>
          </div>

          <button
            onClick={handleNextNote}
            disabled={totalNotes <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/5 hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotesOverlayPage;
