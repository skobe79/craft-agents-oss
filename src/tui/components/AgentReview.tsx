import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from './TextInput.tsx';
import type { Concern } from '../../agents/types.ts';

export interface AgentReviewProps {
  agentName: string;
  concerns: Concern[];
  onSubmit: (answers: Record<string, string>) => void;
}

// Max suggested answers (UI shows up to 4 + custom)
const MAX_SUGGESTED_ANSWERS = 4;

export const AgentReview: React.FC<AgentReviewProps> = ({
  agentName,
  concerns,
  onSubmit,
}) => {
  // Filter to concerns with questions
  const questionsToAsk = concerns.filter(c => c.suggestedQuestion);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState(0); // Index in options array
  const [customText, setCustomText] = useState('');
  const [isCustomActive, setIsCustomActive] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const currentConcern = questionsToAsk[currentIndex];
  // Limit suggested answers to MAX_SUGGESTED_ANSWERS
  const suggestedAnswers = (currentConcern?.suggestedAnswers || []).slice(0, MAX_SUGGESTED_ANSWERS);
  // Options: suggested answers + custom
  const optionCount = suggestedAnswers.length + 1; // +1 for custom
  const customOptionIndex = suggestedAnswers.length;
  const isLastQuestion = currentIndex === questionsToAsk.length - 1;
  const isFirstQuestion = currentIndex === 0;

  // Clear skip message after delay
  useEffect(() => {
    if (showSkipped) {
      const timer = setTimeout(() => {
        setShowSkipped(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showSkipped]);

  // Save current answer and advance (or show review on last question)
  const advanceToNext = useCallback((answer?: string) => {
    if (!currentConcern) return;

    // Build new answers including this one
    const newAnswers = { ...answers };
    if (answer && answer.trim()) {
      newAnswers[currentConcern.suggestedQuestion!] = answer;
    }

    // Reset state for next question
    setCustomText('');
    setSelectedOption(0);
    setIsCustomActive(false);

    if (isLastQuestion) {
      // Save answers and show review
      setAnswers(newAnswers);
      setShowReview(true);
    } else {
      setAnswers(newAnswers);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentConcern, isLastQuestion, answers]);

  // Skip current question (Tab) with visual feedback
  const skipCurrent = useCallback(() => {
    setShowSkipped(true);
    // Advance after brief delay for visual feedback
    setTimeout(() => {
      advanceToNext();
    }, 150);
  }, [advanceToNext]);

  // Go back to previous question (Esc)
  const goBack = useCallback(() => {
    if (isFirstQuestion) return; // No-op on first question

    setCustomText('');
    setSelectedOption(0);
    setIsCustomActive(false);
    setCurrentIndex(prev => prev - 1);
  }, [isFirstQuestion]);

  // Handle final submission from review screen
  const handleSubmit = useCallback(() => {
    setIsSubmitting(true);
    onSubmit(answers);
  }, [answers, onSubmit]);

  // Handle keyboard input
  useInput((input, key) => {
    // If submitting, ignore all input
    if (isSubmitting) return;

    // Review screen keyboard handling
    if (showReview) {
      if (key.return) {
        handleSubmit();
      } else if (key.escape) {
        setShowReview(false);
      }
      return;
    }

    if (!currentConcern) return;

    // If custom input is active, TextInput handles keyboard
    if (isCustomActive) {
      return;
    }

    // Navigation
    if (key.upArrow) {
      setSelectedOption(prev => prev > 0 ? prev - 1 : optionCount - 1);
    } else if (key.downArrow) {
      setSelectedOption(prev => prev < optionCount - 1 ? prev + 1 : 0);
    }
    // Enter to confirm
    else if (key.return) {
      if (selectedOption === customOptionIndex) {
        // Activate custom input
        setIsCustomActive(true);
      } else {
        // Select the suggested answer
        const answer = suggestedAnswers[selectedOption];
        if (answer) {
          advanceToNext(answer);
        }
      }
    }
    // Tab to skip current question
    else if (key.tab) {
      skipCurrent();
    }
    // Escape to go back (no-op on first question)
    else if (key.escape) {
      goBack();
    }
    // Number keys for quick select (1-5 max: 4 options + custom)
    else if (input >= '1' && input <= '5') {
      const idx = parseInt(input, 10) - 1;
      if (idx < optionCount) {
        if (idx === customOptionIndex) {
          setSelectedOption(idx);
          setIsCustomActive(true);
        } else if (idx < suggestedAnswers.length) {
          setSelectedOption(idx);
          advanceToNext(suggestedAnswers[idx]);
        }
      }
    }
  });

  // Handle custom text submission
  const handleCustomSubmit = useCallback(() => {
    if (customText.trim()) {
      advanceToNext(customText.trim());
    } else {
      // Empty custom = skip
      skipCurrent();
    }
  }, [customText, advanceToNext, skipCurrent]);

  // Handle cancel from custom input (Escape)
  const handleCustomCancel = useCallback(() => {
    setIsCustomActive(false);
    setCustomText('');
  }, []);

  // No questions to ask
  if (questionsToAsk.length === 0) {
    return null;
  }

  // Get badge color for concern type
  const getBadgeColor = (type: Concern['type']): string => {
    switch (type) {
      case 'confusing': return 'yellow';
      case 'conflicting': return 'red';
      case 'missing': return 'magenta';
      case 'general': return 'blue';
      default: return 'white';
    }
  };

  // Submitting state
  if (isSubmitting) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={1}>
        <Text color="cyan">Submitting review answers...</Text>
      </Box>
    );
  }

  // Review screen - show all answers before submission
  if (showReview) {
    const answeredQuestions = Object.entries(answers).filter(([_, a]) => a?.trim());
    const skippedCount = questionsToAsk.length - answeredQuestions.length;

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={1}>
        <Box marginBottom={1}>
          <Text backgroundColor="cyan" color="black" bold>
            {' '}Review Answers: @{agentName}{' '}
          </Text>
        </Box>

        {answeredQuestions.length === 0 ? (
          <Box marginBottom={1}>
            <Text dimColor>No answers provided. All questions were skipped.</Text>
          </Box>
        ) : (
          answeredQuestions.map(([q, a], i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text bold>Q: {q}</Text>
              <Text color="green">A: {a}</Text>
            </Box>
          ))
        )}

        {skippedCount > 0 && (
          <Box marginBottom={1}>
            <Text dimColor>({skippedCount} question{skippedCount > 1 ? 's' : ''} skipped)</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Enter to confirm | Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  // No current concern (shouldn't happen, but safety check)
  if (!currentConcern) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text backgroundColor="cyan" color="black" bold>
          {' '}Agent Review: @{agentName}{' '}
        </Text>
        <Text dimColor> ({currentIndex + 1}/{questionsToAsk.length})</Text>
      </Box>

      {/* Concern type badge + description */}
      <Box marginBottom={1}>
        <Text color={getBadgeColor(currentConcern.type)} bold>
          [{currentConcern.type.toUpperCase()}]
        </Text>
        <Text> {currentConcern.description}</Text>
      </Box>

      {/* Context if available */}
      {currentConcern.context && (
        <Box marginBottom={1} marginLeft={2}>
          <Text dimColor italic>"{currentConcern.context}"</Text>
        </Box>
      )}

      {/* Question */}
      <Box marginBottom={1}>
        <Text bold>{currentConcern.suggestedQuestion}</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginLeft={1}>
        {/* Suggested answers */}
        {suggestedAnswers.map((answer, index) => {
          const isHighlighted = index === selectedOption && !isCustomActive;
          return (
            <Box key={index}>
              <Text
                color={isHighlighted ? 'cyan' : undefined}
                bold={isHighlighted}
              >
                {isHighlighted ? '>' : ' '} {index + 1}. {answer}
              </Text>
            </Box>
          );
        })}

        {/* Custom option */}
        <Box marginTop={suggestedAnswers.length > 0 ? 1 : 0}>
          <Text
            color={selectedOption === customOptionIndex && !isCustomActive ? 'cyan' : undefined}
            bold={selectedOption === customOptionIndex && !isCustomActive}
          >
            {selectedOption === customOptionIndex && !isCustomActive ? '>' : ' '} {optionCount}. Custom:
          </Text>
          {isCustomActive ? (
            <Box marginLeft={1}>
              <TextInput
                value={customText}
                onChange={setCustomText}
                onSubmit={handleCustomSubmit}
                onCancel={handleCustomCancel}
                placeholder="Type your answer..."
                isActive={true}
              />
            </Box>
          ) : (
            customText && (
              <Text dimColor> {customText}</Text>
            )
          )}
        </Box>
      </Box>

      {/* Skip feedback */}
      {showSkipped && (
        <Box marginTop={1}>
          <Text color="yellow">Skipped</Text>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text dimColor>
          {isCustomActive
            ? 'Type answer | Enter submit | Esc cancel'
            : `↑↓ select | Enter confirm | Tab skip${!isFirstQuestion ? ' | Esc back' : ''}`
          }
        </Text>
      </Box>
    </Box>
  );
};
