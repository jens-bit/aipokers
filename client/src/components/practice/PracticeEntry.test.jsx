import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { PracticeEntry, readPractice, savePractice } from './PracticeEntry.jsx';

beforeEach(() => localStorage.clear());
it('FIRST-1: progress belongs to an owner and agent, without storing agent records', () => {
  savePractice('owner1', 'agent1', { step: 4, dismissed: true, completed: false });
  expect(readPractice('owner1', 'agent1').step).toBe(4);
  expect(readPractice('owner2', 'agent1').step).toBe(0);
  expect(readPractice('owner1', 'agent2').step).toBe(0);
  expect(JSON.parse(localStorage.getItem(localStorage.key(0)))).toEqual({ version: 1, step: 4, dismissed: true, completed: false });
});
it('FIRST-1: invalid saved steps recover to the start', () => {
  savePractice('owner', 'agent', { step: 400 });
  expect(readPractice('owner', 'agent').step).toBe(0);
});
it('FIRST-1: completion leaves a discoverable replay button', () => {
  savePractice('owner', 'agent', { step: 9, completed: true, dismissed: true });
  const onStart = vi.fn();
  render(<PracticeEntry ownerId="owner" agent={{ id: 'agent', name: 'Granite' }} onStart={onStart}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Learn the table' }));
  expect(onStart).toHaveBeenCalledOnce();
});
