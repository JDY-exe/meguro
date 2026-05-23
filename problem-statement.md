### Problem statement
When learning Japanese, one often encounters words that look similar to each other, for example 溜める (*to save*) and 留める (*to stop*). This is generally referred to as **memory interference**, where the existence of one card significantly hampers the progress of another. *meguro* aims to solve this by adding a special card that pits similar-looking terms next to each other. 

### Parts of the system
#### The *meguro* anki layout
As an expert UI designer, devise a clean, modern layout that incorporates the following elements: 
1. Front: Display *x* Japanese terms
2. Back: Display *x* terms (and their pronunciations using ruby text), their definitions, and example sentences. 
3. Randomized: The order of display for the terms should be randomized each time the card is shown, breaking any pattern-recognizing shortcuts. 
4. Easily addable: The cards should ideally derive their fields from a list, such that a user can easily add content if needed. For example, `words: [A, B, C], definitions: [defA, defB, defC], ...`

#### The frontend card-maker
As an expert UI designer, devise a clean, modern layout that incorporates the following elements:
1. Users can easily add cards by term. If possible, use open source dictionaries like jitendex to fuzzy-search/suggest terms. If the user decides to use a suggested term, auto fill its definition as well. 
2. If the user decides to use a suggested definition, be sure to also format the definition in a coherent way. One example is that dictionaries may use lists for multiple definitions. 
3. If the user decides to use a suggested term, also fill in any example sentences that the dictionary includes (See how jisho.org fetches definitions and example sentences for reference)
4. If the user doesn't want to use a suggested term, make it possible for the user to fill in their own definition. It could be nice if the definition field was md-supported, allowing users to easily format their own content. 
5. FUTURE_CONTENT: The following content is not a part of the project MVP. When engineering the MVP, make design choices that would allow easy integration of any future content, but do not implement it. 
	- Hoist Vercel AI SDK to allow the user to paste in their own LLM api key to enable AI-enhanced features. Keep AI **minimal as possible**, we don't want to shove slop down user's throats. 
	- AI features can include generating sentences that clearly contrasts word usage, or providing hints/explanations on the word differences

#### AnkiConnect hoist
- In the frontend, users should be able to export their created term diffs into the anki directly by having AnkiConnect open. Reference https://github.com/amikey/anki-connect to see the full documentation. 
- In the frontend, users should be able to choose which deck their *meguro* cards go in. 
