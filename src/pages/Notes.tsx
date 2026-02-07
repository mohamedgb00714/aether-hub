import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { db } from '../services/database';
import { Note } from '../types';
import NoteCard from '../components/NoteCard';

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  useEffect(() => {
    loadNotes();
    checkOverlayVisibility();
    
    // Listen for notes changes from other windows (e.g., overlay)
    const unsubscribe = window.electronAPI?.notesOverlay?.onNotesChanged?.(() => {
      console.log('📝 Notes changed from another window, refreshing...');
      loadNotes();
    });
    
    return () => {
      unsubscribe?.();
    };
  }, []);

  const checkOverlayVisibility = async () => {
    const visible = await window.electronAPI?.notesOverlay?.isVisible?.();
    setIsOverlayVisible(visible ?? false);
  };

  const toggleOverlay = async () => {
    await window.electronAPI?.notesOverlay?.toggle?.();
    checkOverlayVisibility();
  };

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const allNotes = await db.notes.getAll();
      setNotes(allNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = async () => {
    const newNote: Partial<Note> = {
      title: '',
      content: '',
      category: activeCategory === 'All' ? 'General' : activeCategory,
      isPinned: false,
      style: { backgroundColor: 'bg-yellow-200' },
      position: { x: 0, y: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedNote = await db.notes.upsert(newNote);
    if (savedNote) {
      setNotes([savedNote as Note, ...notes]);
      // Broadcast to all windows (including overlay) for instant sync
      window.electronAPI?.notesOverlay?.broadcast?.();
    } else {
      loadNotes(); // Fallback to refresh all
    }
  };

  const handleUpdateNote = async (id: number, updates: Partial<Note>) => {
    const updatedNotes = notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n);
    setNotes(updatedNotes);
    
    const noteToUpdate = updatedNotes.find(n => n.id === id);
    if (noteToUpdate) {
      await db.notes.upsert(noteToUpdate);
      // Broadcast to all windows (including overlay) for instant sync
      window.electronAPI?.notesOverlay?.broadcast?.();
    }
  };

  const handleDeleteNote = async (id: number) => {
    await db.notes.delete(id);
    setNotes(notes.filter(n => n.id !== id));
    // Broadcast to all windows (including overlay) for instant sync
    window.electronAPI?.notesOverlay?.broadcast?.();
  };

  const categories = ['All', ...new Set(notes.map(n => n.category))];

  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || n.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort pinned notes to top
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-gray-200 flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Keep Notes</h1>
            <p className="text-gray-500 text-sm">Organize your thoughts and ideas</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleOverlay}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 ${
                isOverlayVisible 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Show floating notes on desktop"
            >
              <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              <span className="font-medium">Float</span>
            </button>
            
            <button
              onClick={handleCreateNote}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="font-medium">New Note</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search your notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button className="p-1.5 rounded-lg bg-white shadow-sm text-blue-600">
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700">
              <ListBulletIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar / Categories */}
        <div className="w-64 border-r border-gray-200 bg-white p-6 overflow-y-auto hidden md:block">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Categories</h3>
          <div className="space-y-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeCategory === cat 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span>{cat}</span>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {cat === 'All' ? notes.length : notes.filter(n => n.category === cat).length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 p-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl text-white">
            <div className="flex items-center space-x-2 mb-2">
              <SparklesIcon className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">AI Smart Organize</span>
            </div>
            <p className="text-[10px] opacity-90 leading-relaxed mb-3">
              Let Atlas automatically categorize your notes and suggest tags based on content.
            </p>
            <button className="w-full py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors">
              Organize Now
            </button>
          </div>
        </div>

        {/* Notes Grid */}
        <div className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : sortedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-40">
              <PlusIcon className="w-16 h-16 mb-4" />
              <p className="text-xl font-medium">No notes found</p>
              <button 
                onClick={handleCreateNote}
                className="mt-4 text-blue-600 hover:underline font-medium"
              >
                Create your first note
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {sortedNotes.map(note => (
                <NoteCard 
                  key={note.id} 
                  note={note}
                  onUpdate={handleUpdateNote}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesPage;
