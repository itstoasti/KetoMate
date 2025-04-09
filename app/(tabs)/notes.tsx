import { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  FlatList, 
  Pressable, 
  Modal, 
  TouchableOpacity,
  Alert,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Storage, Note } from '../../types/storage';
import { getStorageData, setStorageData, checkAndUpdateBadges } from '../../utils/storage';
import { useTheme } from '../../context/ThemeContext';

export default function NotesScreen() {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { isDark } = useTheme();
  
  // Reference to handle autofocus
  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  async function loadData() {
    const data = await getStorageData();
    setStorage(data);
  }
  
  // Filter notes based on search query
  const filteredNotes = searchQuery
    ? storage?.notes.filter(
        note => 
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase())
      ) || []
    : storage?.notes || [];
  
  // Sort notes by most recently updated
  const sortedNotes = [...filteredNotes].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  
  const handleAddNote = async () => {
    if (!storage) return;
    if (!noteTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your note');
      return;
    }
    
    const now = new Date().toISOString();
    const newNote: Note = {
      id: Date.now().toString(),
      title: noteTitle.trim(),
      content: noteContent.trim(),
      createdAt: now,
      updatedAt: now,
    };
    
    // Update the notes created counter
    const notesCreated = storage.stats.notesCreated + 1;
    
    // Prepare updated stats
    const updatedStats = await checkAndUpdateBadges({
      ...storage.stats,
      notesCreated,
    });
    
    const newStorage = {
      ...storage,
      notes: [...storage.notes, newNote],
      stats: updatedStats,
    };
    
    try {
      await setStorageData(newStorage);
      setStorage(newStorage);
      setNoteTitle('');
      setNoteContent('');
      setIsAddModalVisible(false);
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };
  
  const handleUpdateNote = async () => {
    if (!storage || !selectedNote) return;
    if (!noteTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your note');
      return;
    }
    
    const updatedNotes = storage.notes.map(note => 
      note.id === selectedNote.id 
        ? {
            ...note,
            title: noteTitle.trim(),
            content: noteContent.trim(),
            updatedAt: new Date().toISOString(),
          }
        : note
    );
    
    const newStorage = {
      ...storage,
      notes: updatedNotes,
    };
    
    await setStorageData(newStorage);
    setStorage(newStorage);
    setSelectedNote(null);
    setNoteTitle('');
    setNoteContent('');
    setIsEditModalVisible(false);
  };
  
  const handleDeleteNote = async (id: string) => {
    if (!storage) return;
    
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const newNotes = storage.notes.filter(note => note.id !== id);
            
            const newStorage = {
              ...storage,
              notes: newNotes,
            };
            
            await setStorageData(newStorage);
            setStorage(newStorage);
            
            if (isEditModalVisible && selectedNote?.id === id) {
              setIsEditModalVisible(false);
              setSelectedNote(null);
            }
          },
        },
      ]
    );
  };
  
  const openEditModal = (note: Note) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setIsEditModalVisible(true);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getExcerpt = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };
  
  if (!storage) return null;
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F8FAFC' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>Notes</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: isDark ? '#333333' : '#E2E8F0' }]}
          onPress={() => {
            setNoteTitle('');
            setNoteContent('');
            setIsAddModalVisible(true);
          }}
        >
          <Text style={[styles.addButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>+</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput, 
            { 
              backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
              color: isDark ? '#FFFFFF' : '#000000',
              borderColor: isDark ? '#333333' : '#E2E8F0',
            }
          ]}
          placeholder="Search notes..."
          placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {sortedNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {searchQuery ? 'No notes match your search' : 'No notes yet. Tap + to create one!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedNotes}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.notesList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.noteItem, 
                { 
                  backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
                  borderColor: isDark ? '#333333' : '#E2E8F0',
                }
              ]}
              onPress={() => openEditModal(item)}
            >
              <View style={styles.noteHeader}>
                <Text style={[styles.noteTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  {item.title}
                </Text>
                <Text style={[styles.noteDate, { color: isDark ? '#666666' : '#94A3B8' }]}>
                  {formatDate(item.updatedAt)}
                </Text>
              </View>
              <Text 
                style={[styles.noteExcerpt, { color: isDark ? '#94A3B8' : '#64748B' }]}
                numberOfLines={3}
              >
                {getExcerpt(item.content)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
      
      {/* Add Note Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onShow={() => setTimeout(() => titleInputRef.current?.focus(), 100)}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View 
              style={[
                styles.modalContent, 
                { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  New Note
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsAddModalVisible(false)}
                >
                  <Text style={[styles.closeButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                ref={titleInputRef}
                style={[
                  styles.titleInput, 
                  { 
                    borderColor: isDark ? '#333333' : '#E2E8F0',
                    color: isDark ? '#FFFFFF' : '#000000',
                  }
                ]}
                placeholder="Title"
                placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
                value={noteTitle}
                onChangeText={setNoteTitle}
                returnKeyType="next"
                onSubmitEditing={() => contentInputRef.current?.focus()}
              />
              
              <TextInput
                ref={contentInputRef}
                style={[
                  styles.contentInput, 
                  { 
                    backgroundColor: isDark ? '#2A2A2A' : '#F1F5F9',
                    color: isDark ? '#FFFFFF' : '#000000',
                  }
                ]}
                placeholder="Write your note here..."
                placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
                value={noteContent}
                onChangeText={setNoteContent}
                multiline
                textAlignVertical="top"
              />
              
              <TouchableOpacity
                style={[
                  styles.saveButton, 
                  { 
                    backgroundColor: noteTitle.trim() ? '#FF6B00' : (isDark ? '#444444' : '#CBD5E1'),
                    opacity: noteTitle.trim() ? 1 : 0.5
                  }
                ]}
                onPress={handleAddNote}
                disabled={!noteTitle.trim()}
              >
                <Text style={styles.saveButtonText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      
      {/* Edit Note Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onShow={() => setTimeout(() => titleInputRef.current?.focus(), 100)}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View 
              style={[
                styles.modalContent, 
                { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Edit Note
                </Text>
                <View style={styles.headerButtons}>
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: isDark ? '#444444' : '#FEE2E2' }]}
                    onPress={() => selectedNote && handleDeleteNote(selectedNote.id)}
                  >
                    <Text style={[styles.deleteButtonText, { color: isDark ? '#FF6666' : '#EF4444' }]}>
                      🗑️
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setIsEditModalVisible(false)}
                  >
                    <Text style={[styles.closeButtonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <TextInput
                ref={titleInputRef}
                style={[
                  styles.titleInput, 
                  { 
                    borderColor: isDark ? '#333333' : '#E2E8F0',
                    color: isDark ? '#FFFFFF' : '#000000',
                  }
                ]}
                placeholder="Title"
                placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
                value={noteTitle}
                onChangeText={setNoteTitle}
                returnKeyType="next"
                onSubmitEditing={() => contentInputRef.current?.focus()}
              />
              
              <TextInput
                ref={contentInputRef}
                style={[
                  styles.contentInput, 
                  { 
                    backgroundColor: isDark ? '#2A2A2A' : '#F1F5F9',
                    color: isDark ? '#FFFFFF' : '#000000',
                  }
                ]}
                placeholder="Write your note here..."
                placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
                value={noteContent}
                onChangeText={setNoteContent}
                multiline
                textAlignVertical="top"
              />
              
              {selectedNote && (
                <Text style={[styles.lastUpdated, { color: isDark ? '#666666' : '#94A3B8' }]}>
                  Last updated: {formatDate(selectedNote.updatedAt)}
                </Text>
              )}
              
              <TouchableOpacity
                style={[
                  styles.saveButton, 
                  { 
                    backgroundColor: noteTitle.trim() ? '#FF6B00' : (isDark ? '#444444' : '#CBD5E1'),
                    opacity: noteTitle.trim() ? 1 : 0.5
                  }
                ]}
                onPress={handleUpdateNote}
                disabled={!noteTitle.trim()}
              >
                <Text style={styles.saveButtonText}>Update Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  notesList: {
    paddingBottom: 100,
  },
  noteItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  noteDate: {
    fontSize: 12,
  },
  noteExcerpt: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  titleInput: {
    borderBottomWidth: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 12,
    marginBottom: 16,
  },
  contentInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 200,
    marginBottom: 16,
  },
  lastUpdated: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 16,
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
}); 