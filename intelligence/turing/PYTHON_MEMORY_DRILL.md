---
label: Memory Optimization Drill
type: playbook
icon: Cpu
---

## Q: Senior Python Memory Optimization
Analyze the provided Python program, identify memory inefficiencies, and rewrite it to minimize its memory footprint without altering its intended functionality.

### Inefficient Implementation
```python
import csv

def process_large_csv(file_path):
    all_rows = []
    # 1. Read all data into memory at once
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            all_rows.append(row)

    # 2. Filter data into a new list
    active_users = []
    for row in all_rows:
        if row.get('status') == 'active':
            active_users.append(row)

    # 3. Extract scores into another new list
    scores = []
    for user in active_users:
        try:
            scores.append(float(user.get('score', 0)))
        except ValueError:
            pass

    if not scores:
        return 0.0
    
    total = sum(scores)
    average = total / len(scores)
    return average
```

### The Trap Response
"I will use `pandas` to read the CSV file because it is faster and more powerful for data processing."

### Why it fails
While `pandas` is fast, it is notoriously memory-heavy. Loading a multi-gigabyte CSV into a DataFrame can easily exceed the memory limits of a standard backend worker pod (OOM). The task specifically asks for **memory optimization**, not just convenience.

### Optimal Staff Response
The optimal solution is to use **Generators** and **Streaming** to process the file line-by-line, maintaining a $O(1)$ space complexity regardless of file size.

```python
import csv

def process_large_csv_optimized(file_path):
    total_score = 0.0
    count = 0
    
    # Open file as a stream
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        # Process line-by-line (Generator-like iteration)
        for row in reader:
            if row.get('status') == 'active':
                try:
                    score = float(row.get('score', 0))
                    total_score += score
                    count += 1
                except ValueError:
                    continue
                    
    return total_score / count if count > 0 else 0.0
```
**Key Senior Decisions:**
1. **Removed all intermediate lists:** (`all_rows`, `active_users`, `scores`) are gone.
2. **Running Totals:** Maintained simple accumulators instead of a full list of floats.
3. **Lazy Iteration:** The `csv.DictReader` acts as an iterator, keeping only one row in memory at any given time.
