import { snippets } from './snippet';

export const otherComponents = {
	class: snippets('Class components', [
		['Class', 'class A'], ['Class members', 'class A {\n  +String name\n  +run() void\n}'],
		['Inheritance', 'A <|-- B'], ['Composition', 'A *-- B'], ['Aggregation', 'A o-- B'],
		['Association', 'A --> B'], ['Dependency', 'A ..> B'], ['Public property', 'A : +String name'], ['Class note', 'note for A "Note"'],
	]),
	er: snippets('Entity components', [
		['Entity', 'ENTITY'], ['Entity attributes', 'ENTITY {\n  string id PK\n  string name\n}'],
		['One-to-many relation', 'CUSTOMER ||--o{ ORDER : places'], ['Many-to-many relation', 'CUSTOMER }o--o{ PRODUCT : buys'],
	]),
	requirement: snippets('Requirement components', [
		['Requirement', 'requirement req1 {\n  id: 1\n  text: "Required behavior"\n  risk: low\n  verifymethod: test\n}'],
		['Element', 'element item {\n  type: system\n}'],
		['Satisfaction', 'requirement req1 {\n  id: 1\n  text: "Required behavior"\n  risk: low\n  verifymethod: test\n}\nelement item {\n  type: system\n}\nitem - satisfies -> req1'],
	]),
	c4: snippets('C4 components', [
		['Person', 'Person(user, "User")'], ['System', 'System(system, "System")'], ['External system', 'System_Ext(external, "External system")'],
		['Container', 'Container(app, "Application", "Technology")'], ['Component', 'Component(component, "Component", "Technology")'],
		['Relationship', 'Person(user, "User")\nSystem(system, "System")\nRel(user, system, "Uses")'],
		['System boundary', 'System_Boundary(boundary, "Boundary") {\n  Container(app, "Application", "Technology")\n}'],
		['Deployment node', 'Deployment_Node(node, "Node", "Technology") {\n  Container(app, "Application", "Technology")\n}'],
	]),
	block: snippets('Block components', [
		['Column count', 'columns 3'], ['Block', 'A["Block"]'], ['Block spanning two columns', 'A["Wide block"]:2'],
		['Arrow', 'A --> B'], ['Empty cell', 'space'],
		['Nested block', 'block:group\n  A["Block"]\nend'],
	]),
	architecture: snippets('Architecture components', [
		['Group', 'group group1(cloud)[Group]'], ['Server service', 'service server1(server)[Server]'],
		['Database service', 'service database1(database)[Database]'],
		['Grouped service', 'group group1(cloud)[Group]\nservice server1(server)[Server] in group1'],
		['Connection', 'service server1(server)[Server]\nservice database1(database)[Database]\nserver1:R --> L:database1'],
	]),
	info: snippets('Info components', [['Version information', 'showInfo']]),
	usecase: snippets('Use case components', [
		['Actor', 'actor User'], ['Use case', 'Login("Sign in")'], ['Association', 'actor User\nLogin("Sign in")\nUser --> Login'],
		['System boundary', 'systemBoundary system["System"]\n  Login("Sign in")\nend'], ['Direction', 'direction LR'],
	]),
	venn: snippets('Venn components', [
		['Set', 'set A["Set"]: 10'], ['Intersection', 'set A["First"]: 10\nset B["Second"]: 10\nunion A,B["Shared"]: 5'],
		['Title', 'title Sets'],
	]),
	cynefin: snippets('Cynefin components', [
		...['complex', 'complicated', 'clear', 'chaotic', 'confusion'].map(domain => [domain, `${domain}\n  "Task"`] as const),
		['Domain transition', 'complex --> complicated : "Understood"'], ['Title', 'title Framework'],
	]),
	wardley: snippets('Wardley components', [
		['Positioned component', 'component A [0.5, 0.5]'],
		['Dependency', 'component A [0.5, 0.5]\ncomponent B [0.2, 0.8]\nA->B'], ['Title', 'title Value chain'],
	]),
};

export const railroadComponents = {
	'railroad-beta': snippets('Grammar rules', [
		['Terminal', 'rule = terminal("value");'], ['Choice', 'rule = choice(terminal("first"), terminal("second"));'],
		['Optional terminal', 'rule = optional(terminal("value"));'], ['One or more terminals', 'rule = oneOrMore(terminal("value"));'],
	]),
	'railroad-ebnf-beta': snippets('EBNF rules', [
		['Terminal', 'rule = "value";'], ['Alternatives', 'rule = "first" | "second";'],
		['Optional terminal', 'rule = [ "value" ];'], ['Repeated terminal', 'rule = { "value" };'],
	]),
	'railroad-abnf-beta': snippets('ABNF rules', [
		['Terminal', 'rule = "value";'], ['Alternatives', 'rule = "first" / "second";'],
		['Optional terminal', 'rule = ["value"];'], ['One or more terminals', 'rule = 1*"value";'],
	]),
	'railroad-peg-beta': snippets('PEG rules', [
		['Terminal', 'rule <- "value";'], ['Ordered choice', 'rule <- "first" / "second";'],
		['Optional terminal', 'rule <- "value"?;'], ['One or more terminals', 'rule <- "value"+;'],
	]),
};
