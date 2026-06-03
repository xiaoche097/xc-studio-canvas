import { useCallback, useRef, useState } from 'react';
import { createAbortError, throwIfAborted } from '../utils/apiHelpers';

export const useCancelableGeneration = () => {
  const controllerRef = useRef<AbortController | null>(null);
  const taskIdRef = useRef(0);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const startGenerationTask = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    const taskId = taskIdRef.current + 1;
    taskIdRef.current = taskId;
    controllerRef.current = controller;
    setCancelMessage(null);
    return { taskId, signal: controller.signal };
  }, []);

  const cancelGenerationTask = useCallback((message = '已中止生成') => {
    controllerRef.current?.abort();
    setCancelMessage(message);
  }, []);

  const isCurrentGenerationTask = useCallback((taskId: number) => {
    return taskIdRef.current === taskId && !controllerRef.current?.signal.aborted;
  }, []);

  const assertCurrentGenerationTask = useCallback((taskId: number, signal?: AbortSignal) => {
    throwIfAborted(signal);
    if (taskIdRef.current !== taskId) {
      throw createAbortError();
    }
  }, []);

  const finishGenerationTask = useCallback((taskId: number) => {
    if (taskIdRef.current === taskId) {
      controllerRef.current = null;
    }
  }, []);

  return {
    cancelMessage,
    setCancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  };
};
