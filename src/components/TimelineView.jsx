import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EventCard from './EventCard';
import './TimelineView.css';

const MOOD_EMOJIS = {
  joyful: '😄', nostalgic: '🌙', proud: '🏆', sad: '💧',
  excited: '⚡', peaceful: '🕊', grateful: '🌸', adventurous: '🗺'
};

export default function TimelineView({ events, view, editMode, onEdit, onDelete, onReorder, onClickMedia, onSelectEvent }) {
  const [activeMoodPopup, setActiveMoodPopup] = useState(null);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(events);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    onReorder(items);
  };

  const closePopup = () => setActiveMoodPopup(null);

  if (view === 'grid') {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="grid" direction="horizontal">
          {(provided) => (
            <div className="grid-view" ref={provided.innerRef} {...provided.droppableProps}>
              {events.map((event, index) => (
                <Draggable key={event._id} draggableId={event._id} index={index} isDragDisabled={!editMode}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...(editMode ? provided.dragHandleProps : {})}
                      className={`grid-item ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <EventCard event={event} view="grid" editMode={editMode} onEdit={onEdit} onDelete={onDelete} onClickMedia={onClickMedia} onSelectEvent={onSelectEvent} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  // Timeline view
  return (
    <div className="timeline-container">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="timeline">
          {(provided) => (
            <div className="timeline-view" ref={provided.innerRef} {...provided.droppableProps}>
              <div className="timeline-line" />
              {events.map((event, index) => (
                <Draggable key={event._id} draggableId={event._id} index={index} isDragDisabled={!editMode}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`timeline-item ${index % 2 === 0 ? 'left' : 'right'} ${snapshot.isDragging ? 'dragging' : ''}`}
                      style={{ ...provided.draggableProps.style, animationDelay: `${index * 0.08}s` }}
                      data-title={event.title}
                    >
                      <div className="timeline-dot-wrapper">
                        <motion.div 
                          className="timeline-dot" 
                          style={{ background: event.color || '#c4813a' }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMoodPopup(event);
                          }}
                        >
                          <span className="timeline-dot-emoji">{MOOD_EMOJIS[event.mood] || '✦'}</span>
                        </motion.div>
                        <div className="timeline-dot-ring" style={{ borderColor: event.color || '#c4813a' }} />
                        
                        {/* Interactive Mood Popup */}
                        <AnimatePresence>
                          {activeMoodPopup?._id === event._id && (
                            <motion.div 
                              className="mood-detail-popup glass-card"
                              initial={{ opacity: 0, scale: 0.8, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.8, y: -10 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button className="popup-close" onClick={closePopup}>✕</button>
                              <div className="popup-mood-header">
                                <span className="popup-mood-emoji">{MOOD_EMOJIS[event.mood]}</span>
                                <span className="popup-mood-label" style={{ color: event.color }}>{event.mood}</span>
                              </div>
                              <h4 className="popup-title">{event.title}</h4>
                              <div className="popup-info">
                                <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                                {event.location && <span>📍 {event.location}</span>}
                              </div>
                              <button 
                                className="btn btn-primary btn-sm popup-view-btn"
                                onClick={() => {
                                  onSelectEvent(event);
                                  closePopup();
                                }}
                              >
                                View Memory ✦
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className={`timeline-connector ${index % 2 === 0 ? 'left-connector' : 'right-connector'}`} />

                      <div className="timeline-card-wrapper"
                        style={{ cursor: onSelectEvent ? 'pointer' : 'default' }}
                        onClick={() => !editMode && onSelectEvent && onSelectEvent(event)}
                      >
                        {editMode && (
                          <div {...provided.dragHandleProps} className="drag-handle" title="Drag to reorder">
                            ⠿
                          </div>
                        )}
                        <EventCard
                          event={event}
                          view="timeline"
                          editMode={editMode}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onClickMedia={onClickMedia}
                          onSelectEvent={onSelectEvent}
                        />
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
