import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedPractice } from './GuidedPractice.jsx';
import { PracticeEntry } from './PracticeEntry.jsx';
import { savePractice } from './PracticeEntry.jsx';

const agent = { id: 'lesson-agent', name: 'Granite', nature: 'Steady', accentColor: '#00D4AA' };
beforeEach(() => localStorage.clear());

describe('FIRST-1: guided practice', () => {
  it('makes the existing guest sign-in requirement clear before a real chat', () => {
    savePractice('owner-a', agent.id, { step: 8, dismissed: true, completed: false });
    const onChat = vi.fn();
    render(<GuidedPractice agent={agent} ownerId="owner-a" isGuest onChat={onChat} />);
    fireEvent.click(screen.getByRole('button', { name: 'Why did you bet?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish practice' }));
    expect(screen.getByText(/Sign in to send your own messages/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to chat with Granite' }));
    expect(onChat).toHaveBeenCalledWith(agent);
  });
  it('advances only on request and never sends a request or live table action', () => {
    const requests = vi.mocked(fetch).mock.calls.length;
    render(<GuidedPractice agent={agent} ownerId="owner-a" onExit={vi.fn()} />);
    expect(screen.getByTestId('guided-practice')).toHaveAttribute('data-step', 'deal');
    expect(screen.getByTestId('practice-role')).toHaveTextContent('You are watching. Granite is playing.');
    expect(screen.queryByText(/kings full of sevens/i)).not.toBeInTheDocument();
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    expect(screen.getByTestId('guided-practice')).toHaveAttribute('data-step', 'showdown');
    expect(screen.getByTestId('practice-result')).toHaveTextContent('28');
    expect(screen.getByTestId('practice-result')).toHaveTextContent('+14');
    expect(screen.getByTestId('practice-result')).toHaveTextContent(/kings full of sevens/i);
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    expect(screen.getByRole('button', { name: 'Finish practice' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Why did you bet?' }));
    expect(screen.getByTestId('practice-answer')).toHaveTextContent(/strong hand/i);
    fireEvent.click(screen.getByRole('button', { name: 'Finish practice' }));
    expect(screen.getByTestId('guided-practice')).toHaveAttribute('data-step', 'complete');
    expect(fetch).toHaveBeenCalledTimes(requests);
  });

  it('resumes only the same owner and agent, and can restart after completion', () => {
    const view = render(<GuidedPractice agent={agent} ownerId="owner-a" onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    view.unmount();
    const resumed = render(<GuidedPractice agent={agent} ownerId="owner-a" onExit={vi.fn()} />);
    expect(screen.getByTestId('guided-practice')).toHaveAttribute('data-step', 'flop');
    resumed.unmount();
    render(<GuidedPractice agent={agent} ownerId="owner-b" onExit={vi.fn()} />);
    expect(screen.getByTestId('guided-practice')).toHaveAttribute('data-step', 'deal');
  });

  it('leaves by Escape without claiming a completed lesson', () => {
    const onExit = vi.fn();
    const view = render(<GuidedPractice agent={agent} ownerId="owner-a" onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledOnce();
    view.unmount();
    render(<PracticeEntry agent={agent} ownerId="owner-a" onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Resume practice' })).toBeInTheDocument();
  });

  it('keeps a replay entry after declining guidance without opening it automatically', () => {
    const onStart = vi.fn();
    render(<PracticeEntry agent={agent} ownerId="owner-a" onStart={onStart} />);
    expect(screen.getByRole('button', { name: 'Learn with Granite' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Learn the table' }));
    expect(onStart).toHaveBeenCalledWith(agent);
  });
});
