import { useState } from 'react';
import { checkForDuplicateOrder, OrderValidationData, DuplicateCheckResult } from '@/lib/duplicateOrderValidator';

export const useDuplicateOrderCheck = () => {
  const [isChecking, setIsChecking] = useState(false);

  const checkDuplicate = async (data: OrderValidationData): Promise<DuplicateCheckResult> => {
    setIsChecking(true);
    try {
      const result = await checkForDuplicateOrder(data);
      return result;
    } finally {
      setIsChecking(false);
    }
  };

  return { checkDuplicate, isChecking };
};
