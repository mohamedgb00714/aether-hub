import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookmarkIcon as PinIconSolid,
  XMarkIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/solid';
import { Note } from '../types';

interface FloatingNoteProps {
  note: Note;
  onUnpin: (id: number) => void;
  onPositionChange: (position: { x: number, y: number }) => void;
}

const FloatingNote: React.FC<FloatingNoteProps> = ({ note, onUnpin, onPositionChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={(_e, info) => {
        onPositionChange({ x: info.point.x, y: info.point.y });
      }}
      initial={{ x: note.position.x || 100, y: note.position.y || 100, opacity: 0, scale: 0.8 }}
      animate={{ x: note.position.x || 100, y: note.position.y || 100, opacity: 1, scale: 1 }}
      className={`fixed z-[100] cursor-grab active:cursor-grabbing shadow-2xl rounded-lg p-4 overflow-hidden ${
        note.style.backgroundColor || 'bg-yellow-200'
      } ${note.style.color || 'text-gray-800'} ${
        isExpanded ? 'w-80 h-80' : 'w-48 h-48'
      } transition-size duration-200`}
      style={{
        fontFamily: note.style.fontFamily || 'inherit',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-1">
          <PinIconSolid className="w-3 h-3 text-red-500 opacity-50" />
          <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate max-w-[80px]">
            {note.category}
          </h4>
        </div>
        <div className="flex space-x-1">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-black/5 rounded group"
          >
            <ArrowsPointingOutIcon className="w-3 h-3 opacity-30 group-hover:opacity-100" />
          </button>
          <button 
            onClick={() => onUnpin(note.id)}
            className="p-1 hover:bg-black/5 rounded group"
          >
            <XMarkIcon className="w-3 h-3 opacity-30 group-hover:opacity-100" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="h-full overflow-y-auto overflow-x-hidden">
        {note.title && (
          <h5 className="font-bold text-xs mb-1 border-b border-black/5 pb-1">
            {note.title}
          </h5>
        )}
        <p className={`whitespace-pre-wrap ${isExpanded ? 'text-sm' : 'text-[11px]'} leading-relaxed`}>
          {note.content}
        </p>
      </div>

      {/* Resize Handle / Visual Marker */}
      <div className="absolute bottom-1 right-1 opacity-20">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
          <line x1="10" y1="5" x2="5" y2="10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </motion.div>
  );
};

export default FloatingNote;
