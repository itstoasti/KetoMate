import React from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Food } from '@/types';
import FoodCard from './FoodCard'; // Reuse FoodCard for display
import { X, Trash2 } from 'lucide-react-native';

interface FavoritesModalProps {
  visible: boolean;
  onClose: () => void;
  favorites: Food[];
  onSelectFavorite: (food: Food) => void;
  onRemoveFavorite: (foodId: string) => void;
}

const FavoritesModal: React.FC<FavoritesModalProps> = ({ 
  visible,
  onClose,
  favorites,
  onSelectFavorite,
  onRemoveFavorite
}) => {

  const renderFavoriteItem = ({ item }: { item: Food }) => (
    <View style={styles.itemContainer}>
      <FoodCard 
        food={item} 
        onPress={() => onSelectFavorite(item)} 
        // Don't show favorite star *within* favorites list
      />
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => onRemoveFavorite(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={20} color="#FF5252" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={false} // Usually better to have a solid background
      visible={visible}
      onRequestClose={onClose} // For hardware back button on Android
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Favorite Foods</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={28} color="#555" />
            </TouchableOpacity>
          </View>
          
          {favorites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>You haven't added any favorites yet.</Text>
              <Text style={styles.emptySubText}>Search for a food and tap the star icon to add it!</Text>
            </View>
          ) : (
            <FlatList
              data={favorites}
              renderItem={renderFavoriteItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  listContent: {
    padding: 15,
  },
  itemContainer: {
    marginBottom: 10,
    position: 'relative', // Needed for absolute positioning of remove button
  },
  removeButton: {
    position: 'absolute',
    top: 10,  // Adjust position relative to FoodCard padding
    right: 10, // Adjust position relative to FoodCard padding
    padding: 8,
    zIndex: 2, // Ensure it's above the card
    // backgroundColor: 'rgba(255,255,255,0.7)', // Optional subtle background
    // borderRadius: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  }
});

export default FavoritesModal; 