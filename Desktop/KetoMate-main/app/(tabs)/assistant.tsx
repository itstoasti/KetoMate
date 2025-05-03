import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAppContext } from '@/context/AppContext';
import ChatBubble from '@/components/ChatBubble';
import { getAnswerToQuestion, analyzeFood, getSuggestedMeals, mockAnalyzeFood, mockSuggestedMeals } from '@/services/aiService';
import { Bot, Send, CirclePlus as PlusCircle, Search, UtensilsCrossed, ChevronRight } from 'lucide-react-native';

export default function AssistantScreen() {
  const { 
    currentConversation, 
    createNewConversation, 
    addMessageToConversation,
    conversations,
    setCurrentConversation
  } = useAppContext();
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Add logging
  console.log('[AssistantScreen Render] Current Conversation:', JSON.stringify(currentConversation, null, 2));

  // Effect to manually update currentConversation based on the main list
  useEffect(() => {
    if (currentConversation?.id) {
      const updatedConv = conversations.find(c => c.id === currentConversation.id);
      if (updatedConv && updatedConv !== currentConversation) {
        console.log('[AssistantScreen Effect] Found updated conversation in main list, setting current...');
        setCurrentConversation(updatedConv); // Sync if needed
      }
    }
    console.log('[AssistantScreen Effect] Current Conversation Updated:', JSON.stringify(currentConversation, null, 2));
    // Scroll to bottom when messages update
    if (currentConversation?.messages?.length) { // Check if messages exist
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversations, currentConversation, setCurrentConversation]); // Depend on conversations list and the setter
  
  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    let finalConversationId = currentConversation?.id;
    const isNewConversation = !finalConversationId;
    
    if (isNewConversation) {
      console.log('[AssistantScreen handleSend] Creating new conversation...');
      finalConversationId = createNewConversation('Keto Assistant Conversation'); 
      console.log('[AssistantScreen handleSend] New conversation ID:', finalConversationId);
    }
    
    if (!finalConversationId) {
      console.error('[AssistantScreen handleSend] Failed to get a conversation ID.');
      setIsLoading(false); // Stop loading if we can't proceed
      return;
    }

    const userMessageContent = inputText;
    setInputText('');
    setIsLoading(true);
    
    // Add user message (only updates the main list now)
    console.log('[AssistantScreen handleSend] Adding user message to:', finalConversationId);
    addMessageToConversation(finalConversationId, {
      role: 'user',
      content: userMessageContent
    });
        
    // Immediately try to set the current conversation after adding user message
    // Note: This relies on the state update from addMessageToConversation being available quickly.
    // We might need a small delay or use the useEffect above to handle this reliably.
    // For now, let's keep it simple.

    try {
      console.log('[AssistantScreen handleSend] Getting AI answer...');
      const response = await getAnswerToQuestion(userMessageContent);
      console.log('[AssistantScreen handleSend] Received AI answer:', response);
        
      // Add AI response (only updates the main list now)
      console.log('[AssistantScreen handleSend] Adding assistant message to:', finalConversationId);
      addMessageToConversation(finalConversationId, {
          role: 'assistant',
          content: response
        });
      console.log('[AssistantScreen handleSend] Assistant message added (queued to main list).');

      // --- Explicitly set current conversation AFTER adding assistant message --- 
      // Wait a tick for the state update in context to potentially settle (though not guaranteed)
      // A better approach might involve making addMessageToConversation return the updated conv
      // For now, rely on the useEffect to catch the update.

    } catch (error) {
      console.error('Error getting AI response:', error);
      if (finalConversationId) {
        console.log('[AssistantScreen handleSend] Adding ERROR message to:', finalConversationId);
        addMessageToConversation(finalConversationId, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again later.'
      });
      }
    } finally {
      console.log('[AssistantScreen handleSend] Finally block executing.');
      setIsLoading(false);
      console.log('[AssistantScreen handleSend] isLoading set to false.');
    }
  };
  
  const renderSuggestions = () => {
    const suggestions = [
      { 
        icon: <Search size={18} color="#4CAF50" />,
        text: 'Is avocado keto-friendly?',
      },
      {
        icon: <UtensilsCrossed size={18} color="#FFC107" />,
        text: 'Suggest meal ideas for lunch',
      },
      {
        icon: <Bot size={18} color="#FF5252" />,
        text: 'What is the keto flu?',
      }
    ];
    
    return (
      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>Try asking:</Text>
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.suggestionItem}
            onPress={() => setInputText(suggestion.text)}
          >
            {suggestion.icon}
            <Text style={styles.suggestionText}>{suggestion.text}</Text>
            <ChevronRight size={16} color="#888" />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Keto Assistant</Text>
        <Text style={styles.subtitle}>Ask anything about keto diet</Text>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {!currentConversation || currentConversation.messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bot size={60} color="#4CAF50" style={styles.botIcon} />
            <Text style={styles.welcomeTitle}>Keto Diet Assistant</Text>
            <Text style={styles.welcomeText}>
              I can help you analyze foods, suggest meals, and answer questions about the ketogenic diet!
            </Text>
            {renderSuggestions()}
          </View>
        ) : (
          currentConversation.messages.map(message => (
            <ChatBubble key={message.id} message={message} />
          ))
        )}
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask about keto diet..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && styles.disabledButton]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          <Send size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {conversations.length > 0 && (
        <TouchableOpacity 
          style={styles.newChatButton}
          onPress={() => createNewConversation('New Conversation')}
        >
          <PlusCircle size={18} color="#4CAF50" />
          <Text style={styles.newChatText}>New Conversation</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 24,
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  botIcon: {
    marginBottom: 16,
    opacity: 0.9,
  },
  welcomeTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 20,
    color: '#333',
    marginBottom: 12,
  },
  welcomeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  suggestionsContainer: {
    width: '100%',
    marginTop: 16,
  },
  suggestionsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 12,
    paddingTop: 12,
    maxHeight: 120,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F1F1F1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 8,
    marginLeft: 16,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  newChatText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 6,
  },
});