import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AIMessage } from '@/types';
import { format, parseISO } from 'date-fns';

interface ChatBubbleProps {
  message: AIMessage;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const formatTime = (timestamp: string) => {
    try {
      return format(parseISO(timestamp), 'h:mm a');
    } catch (e) {
      return '';
    }
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.message, isUser ? styles.userMessage : styles.assistantMessage]}>
          {message.content}
        </Text>
      </View>
      <Text style={styles.time}>{formatTime(message.timestamp)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    marginVertical: 8,
  },
  userContainer: {
    alignSelf: 'flex-end',
    marginRight: 16,
  },
  assistantContainer: {
    alignSelf: 'flex-start',
    marginLeft: 16,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F1F1F1',
    borderBottomLeftRadius: 4,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessage: {
    color: 'white',
  },
  assistantMessage: {
    color: '#333',
  },
  time: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});

export default ChatBubble;