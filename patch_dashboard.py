import re

with open('app/dashboard/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the style block inside ProjectRow and replace it
# Use regex to match the entire style jsx block
pattern = re.compile(
    r'(<style jsx>\{`\s*\.project-row \{.*?`\}</style>)',
    re.DOTALL
)

replacement = '''<style jsx>{`
        .project-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          min-height: 72px;
          gap: 1rem;
          overflow: hidden;
        }
        .row-main {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          min-width: 0;
          flex: 1;
        }
        .row-type {
          background: var(--primary-glow);
          color: var(--primary);
          padding: 0.5rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .row-title-container {
          min-width: 0;
          overflow: hidden;
        }
        .row-title-container h4 {
          font-size: 1rem;
          margin: 0 0 0.15rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .row-title-container span {
          font-size: 0.8rem;
          opacity: 0.5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }
        .row-meta {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-shrink: 0;
        }
        .project-stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          font-size: 0.78rem;
          opacity: 0.6;
          white-space: nowrap;
          line-height: 1.4;
        }
        .row-price {
          font-weight: 700;
          white-space: nowrap;
          font-size: 0.95rem;
        }
        .status-badge {
          padding: 0.3rem 0.7rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
          white-space: nowrap;
        }
        .status-badge.paid {
          background: rgba(39, 245, 187, 0.15);
          color: var(--primary);
        }
        .status-badge.pending {
          background: rgba(255, 193, 7, 0.15);
          color: #f59e0b;
        }
        .status-badge.completed {
          background: rgba(39, 245, 187, 0.15);
          color: var(--primary);
        }
        .row-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-shrink: 0;
        }
        .btn-icon {
          background: transparent;
          border: none;
          color: var(--foreground);
          cursor: pointer;
          opacity: 0.45;
          transition: opacity 0.2s, color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.3rem;
          border-radius: 6px;
        }
        .btn-icon:hover {
          opacity: 1;
          color: var(--primary);
          background: var(--primary-glow);
        }
        @media (max-width: 768px) {
          .project-row {
            flex-direction: column;
            align-items: stretch;
            padding: 1rem;
            gap: 0.75rem;
            min-height: unset;
          }
          .row-main { align-items: flex-start; }
          .row-title-container h4 {
            white-space: normal;
            word-break: break-word;
          }
          .row-meta {
            flex-wrap: wrap;
            gap: 0.75rem;
            border-top: 1px solid rgba(0,0,0,0.05);
            padding-top: 0.75rem;
          }
          .project-stats {
            align-items: flex-start;
            flex-direction: row;
            gap: 0.75rem;
          }
          .status-badge { align-self: flex-start; }
          .row-actions { justify-content: flex-start; }
        }
      `}</style>'''

matches = pattern.findall(content)
if matches:
    new_content = pattern.sub(replacement, content, count=1)
    with open('app/dashboard/page.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'SUCCESS: replaced {len(matches)} occurrence(s)')
else:
    print('PATTERN NOT MATCHED')
    # Debug: show context around .project-row
    idx = content.find('.project-row {')
    if idx != -1:
        print('Context:', repr(content[idx-20:idx+60]))
