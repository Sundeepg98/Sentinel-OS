---
label: Seniority & Trade-offs
type: playbook
icon: GraduationCap
---

## Q: The Monolith vs. Microservices Decision
A high-growth Turing client wants to split their 2-year-old Node.js monolith into microservices immediately. What is your architectural advice?

### The Trap Response
"Yes, microservices are the industry standard for scaling and we should move to them as soon as possible."

### Why it fails
This is a classic "Staff-level mistake." Premature decomposition increases operational complexity by 10x. It introduces network latency, distributed transaction issues, and makes local debugging nearly impossible. If the team is small (< 10 devs), the overhead of microservices will kill their velocity.

### Optimal Staff Response
I would first evaluate the **Domain Boundaries**. I recommend a **Modular Monolith** first. We should enforce strict internal boundaries (clean architecture) within the existing codebase. We only extract a microservice when:
1. **Scaling requirements diverge**: (e.g., one module needs 100x more CPU than the rest).
2. **Deployment cycles differ**: (e.g., the billing team needs to release 10x a day, but the core engine is on a weekly cycle).
3. **Team ownership**: The team has grown so large that they are stepping on each other's toes.

---

## Q: Managing Technical Debt in IaC
You inherit a Pulumi codebase where everything is in a single `index.ts` with 5,000 lines of code. How do you refactor this while the system is live?

### The Trap Response
"I will rewrite the entire thing in a new stack and migrate the resources one by one."

### Why it fails
Destroying and recreating resources causes unacceptable downtime. Migrating manually is error-prone and risks resource orphaning.

### Optimal Staff Response
I would perform an **In-place Decomposition**. 
1. I’ll start by creating **ComponentResources** to logically group related items (e.g., all VPC resources) within the same stack. 
2. Once the code is modular, I use **Stack References**. 
3. I would utilize `pulumi state delete` and `pulumi import` or the `aliases` property to move resources between stacks without destroying the underlying cloud assets. This maintains 100% uptime while decoupling the infrastructure.
