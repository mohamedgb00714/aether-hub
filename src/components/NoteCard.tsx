import React, { useState, useRef, useEffect } from 'react';
import { 
  BookmarkIcon as PinIconSolid,
  TrashIcon, 
  ArrowPathIcon,
  SwatchIcon,
  TagIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/solid';
import { 
  BookmarkIcon as PinIconOutline 
} from '@heroicons/react/24/outline';
import { Note, NoteStyle } from '../types';

interface NoteCardProps {
  note: Note;
  onUpdate: (id: number, updates: Partial<Note>) => void;
  onDelete: (id: number) => void;
}

const STYLES = [
  { name: 'Sticky Yellow', bg: 'bg-yellow-200', text: 'text-gray-800' },
  { name: 'Soft Blue', bg: 'bg-blue-100', text: 'text-gray-800' },
  { name: 'Mint Green', bg: 'bg-green-100', text: 'text-gray-800' },
  { name: 'Lavender', bg: 'bg-purple-100', text: 'text-gray-800' },
  { name: 'Rose', bg: 'bg-red-100', text: 'text-gray-800' },
  { name: 'Dark Mode', bg: 'bg-gray-800', text: 'text-gray-100' },
];

const NoteCard: React.FC<NoteCardProps> = ({ note, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(note.category);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
      categoryInputRef.current.select();
    }
  }, [isEditingCategory]);

  const handleCategorySave = () => {
    if (categoryInput.trim() && categoryInput !== note.category) {
      onUpdate(note.id, { category: categoryInput.trim() });
    }
    setIsEditingCategory(false);
  };

  const handleBlur = () => {
    if (title !== note.title || content !== note.content) {
      onUpdate(note.id, { title, content });
    }
    setIsEditing(false);
  };

  const currentStyle = STYLES.find(s => s.bg === note.style.backgroundColor) || STYLES[0];

  return (
    <div 
      className={`relative w-full aspect-square ${currentStyle.bg} ${currentStyle.text} p-6 shadow-lg transform transition-all hover:scale-[1.02] hover:-rotate-1 group`}
      style={{
        fontFamily: note.style.fontFamily || 'inherit',
        fontSize: note.style.fontSize || '1rem',
      }}
    >
      {/* Pin Overlay */}
      <button 
        onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })}
        className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {note.isPinned ? (
          <PinIconSolid className="w-5 h-5 text-red-500" />
        ) : (
          <PinIconOutline className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Header / Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleBlur}
        placeholder="Note Title"
        className="w-full bg-transparent font-bold text-lg mb-2 focus:outline-none border-b border-transparent focus:border-black/10"
      />

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleBlur}
        placeholder="Write something..."
        className="w-full h-[calc(100%-4rem)] bg-transparent resize-none focus:outline-none text-sm leading-relaxed"
      />

      {/* Footer Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex space-x-2 items-center">
          <button 
            onClick={() => setShowStylePicker(!showStylePicker)}
            className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
            title="Style"
          >
            <SwatchIcon className="w-4 h-4" />
          </button>
          
          {isEditingCategory ? (
            <div className="flex items-center space-x-1">
              <input
                ref={categoryInputRef}
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCategorySave();
                  if (e.key === 'Escape') {
                    setCategoryInput(note.category);
                    setIsEditingCategory(false);
                  }
                }}
                className="w-20 px-1 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-white/50 rounded border border-black/10 focus:outline-none focus:border-black/30"
              />
              <button onClick={handleCategorySave} className="p-0.5 hover:bg-black/5 rounded">
                <CheckIcon className="w-3 h-3 text-green-600" />
              </button>
              <button onClick={() => { setCategoryInput(note.category); setIsEditingCategory(false); }} className="p-0.5 hover:bg-black/5 rounded">
                <XMarkIcon className="w-3 h-3 text-red-600" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditingCategory(true)}
              className="text-[10px] uppercase tracking-wider font-semibold opacity-60 hover:opacity-100 transition-opacity flex items-center"
              title="Click to edit category"
            >
              <TagIcon className="w-3 h-3 mr-1" />
              {note.category}
            </button>
          )}
        </div>
        
        {showDeleteConfirm ? (
          <div className="flex items-center space-x-1 bg-white/80 rounded-lg px-2 py-1">
            <span className="text-[10px] font-medium mr-1">Delete?</span>
            <button 
              onClick={() => onDelete(note.id)}
              className="p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              title="Confirm Delete"
            >
              <CheckIcon className="w-3 h-3" />
            </button>
            <button 
              onClick={() => setShowDeleteConfirm(false)}
              className="p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
              title="Cancel"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-full hover:bg-red-500/10 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Style Picker Popover */}
      {showStylePicker && (
        <div className="absolute bottom-12 left-4 bg-white rounded-xl shadow-2xl p-3 grid grid-cols-3 gap-2 z-10 border border-gray-100">
          {STYLES.map((style) => (
            <button
              key={style.name}
              onClick={() => {
                onUpdate(note.id, { 
                  style: { 
                    ...note.style, 
                    backgroundColor: style.bg,
                    color: style.text === 'text-gray-100' ? '#f3f4f6' : '#1f2937'
                  } 
                });
                setShowStylePicker(false);
              }}
              className={`w-8 h-8 rounded-full ${style.bg} border border-gray-200 hover:ring-2 ring-blue-500 transition-all`}
              title={style.name}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteCard;
