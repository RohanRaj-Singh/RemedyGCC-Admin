'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QuestionCard } from './QuestionCard';
import { Question, ScannerFollowUpTrigger } from '../types';
import { GripVertical } from 'lucide-react';

interface SortableQuestionCardProps {
  question: Question;
  index: number;
  siblingQuestions: Question[];
  followUpTriggers?: ScannerFollowUpTrigger[];
  disabled?: boolean;
  canRemove: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (question: Question) => void;
  onRemove: (questionId: string) => void;
  onTriggersChange?: (triggers: ScannerFollowUpTrigger[]) => void;
  dragError?: boolean;
}

export function SortableQuestionCard(props: SortableQuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${isDragging ? 'shadow-2xl' : ''}`}>
      <div 
        className={`absolute left-0 top-6 -translate-x-1/2 flex items-center justify-center p-2 cursor-grab active:cursor-grabbing z-20 bg-white border rounded-full shadow-sm transition-colors ${
          props.dragError ? 'text-red-500 border-red-300 bg-red-50' : 'text-gray-400 hover:text-gray-600 border-gray-200'
        }`} 
        {...attributes} 
        {...listeners}
      >
        <GripVertical size={16} />
      </div>
      <QuestionCard 
        {...props} 
        dragError={props.dragError}
        followUpTriggers={props.followUpTriggers}
        onTriggersChange={props.onTriggersChange}
      />
    </div>
  );
}