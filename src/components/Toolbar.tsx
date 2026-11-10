import { forwardRef, type ReactNode } from 'react';
import { PRIORITIES, type Filters, type Label, type Member, type Priority } from '../types';
import { ChevronDownIcon, CloseIcon, PriorityIcon, SearchIcon, TagIcon, UsersIcon, FilterIcon } from './Icons';
import { Avatar, CheckList, Popover } from './ui';

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  members: Member[];
  labels: Label[];
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const Toolbar = forwardRef<HTMLInputElement, Props>(function Toolbar(
  { filters, onChange, members, labels },
  searchRef,
) {
  const active =
    filters.query.trim() !== '' ||
    filters.priorities.length + filters.labelIds.length + filters.assigneeIds.length > 0;

  return (
    <div className="toolbar" role="search">
      <label className="search">
        <SearchIcon />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search tasks"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          aria-label="Search tasks by title"
        />
        {filters.query ? (
          <button
            type="button"
            className="search__clear"
            onClick={() => onChange({ ...filters, query: '' })}
            aria-label="Clear search"
          >
            <CloseIcon size={12} />
          </button>
        ) : (
          <kbd className="kbd">/</kbd>
        )}
      </label>

      <div className="toolbar__filters">
        <FilterButton
          icon={<FilterIcon />}
          name="Priority"
          count={filters.priorities.length}
        >
          <CheckList
            options={PRIORITIES.map((p) => ({
              id: p.id,
              name: p.name,
              leading: (
                <span className={`priority priority--${p.id}`}>
                  <PriorityIcon level={p.id} />
                </span>
              ),
            }))}
            selected={filters.priorities}
            onToggle={(id) => onChange({ ...filters, priorities: toggle(filters.priorities, id as Priority) })}
          />
        </FilterButton>

        <FilterButton icon={<TagIcon />} name="Label" count={filters.labelIds.length}>
          <CheckList
            options={labels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
            selected={filters.labelIds}
            onToggle={(id) => onChange({ ...filters, labelIds: toggle(filters.labelIds, id) })}
            empty="No labels yet. Create some from Team & labels."
          />
        </FilterButton>

        <FilterButton icon={<UsersIcon />} name="Assignee" count={filters.assigneeIds.length}>
          <CheckList
            options={members.map((m) => ({ id: m.id, name: m.name, leading: <Avatar member={m} size={18} /> }))}
            selected={filters.assigneeIds}
            onToggle={(id) => onChange({ ...filters, assigneeIds: toggle(filters.assigneeIds, id) })}
            empty="No team members yet. Add some from Team & labels."
          />
        </FilterButton>

        {active && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onChange({ query: '', priorities: [], labelIds: [], assigneeIds: [] })}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
});

function FilterButton({
  icon,
  name,
  count,
  children,
}: {
  icon: ReactNode;
  name: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Popover
      width={220}
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          className={`chip-btn${count > 0 ? ' is-active' : ''}`}
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
        >
          {icon}
          {name}
          {count > 0 && <span className="chip-btn__count">{count}</span>}
          <ChevronDownIcon size={12} />
        </button>
      )}
    >
      {() => children}
    </Popover>
  );
}
