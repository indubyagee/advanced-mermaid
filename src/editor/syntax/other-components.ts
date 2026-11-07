import { snippets } from './snippet';

export const otherComponents = {
	class: snippets('Class components', [
		'class A', ['Class members', 'class A {\n  +String name\n  +run() void\n}'],
		'A <|-- B', 'A *-- B', 'A o-- B', 'A --> B', 'A ..> B', 'A : +String name', 'note for A "Note"',
	]),
	er: snippets('Entity components', [
		'ENTITY', ['Entity attributes', 'ENTITY {\n  string id PK\n  string name\n}'],
		'CUSTOMER ||--o{ ORDER : places', 'CUSTOMER }o--o{ PRODUCT : buys',
	]),
	requirement: snippets('Requirement components', [
		['Requirement', 'requirement req1 {\n  id: 1\n  text: "Required behavior"\n  risk: low\n  verifymethod: test\n}'],
		['Element', 'element item {\n  type: system\n}'],
		['Satisfaction', 'requirement req1 {\n  id: 1\n  text: "Required behavior"\n  risk: low\n  verifymethod: test\n}\nelement item {\n  type: system\n}\nitem - satisfies -> req1'],
	]),
	c4: snippets('C4 components', [
		'Person(user, "User")', 'System(system, "System")', 'System_Ext(external, "External system")',
		'Container(app, "Application", "Technology")', 'Component(component, "Component", "Technology")',
		['Relationship', 'Person(user, "User")\nSystem(system, "System")\nRel(user, system, "Uses")'],
		['System boundary', 'System_Boundary(boundary, "Boundary") {\n  Container(app, "Application", "Technology")\n}'],
		['Deployment node', 'Deployment_Node(node, "Node", "Technology") {\n  Container(app, "Application", "Technology")\n}'],
	]),
	block: snippets('Block components', [
		'columns 3', 'A["Block"]', 'A["Wide block"]:2', 'A --> B', 'space',
		['Nested block', 'block:group\n  A["Block"]\nend'],
	]),
	architecture: snippets('Architecture components', [
		'group group1(cloud)[Group]', 'service server1(server)[Server]', 'service database1(database)[Database]',
		['Grouped service', 'group group1(cloud)[Group]\nservice server1(server)[Server] in group1'],
		['Connection', 'service server1(server)[Server]\nservice database1(database)[Database]\nserver1:R --> L:database1'],
	]),
	info: snippets('Info components', ['showInfo']),
	usecase: snippets('Use case components', [
		'actor User', 'Login("Sign in")', ['Association', 'actor User\nLogin("Sign in")\nUser --> Login'],
		['System boundary', 'systemBoundary system["System"]\n  Login("Sign in")\nend'], 'direction LR',
	]),
	venn: snippets('Venn components', [
		'set A["Set"]: 10', ['Intersection', 'set A["First"]: 10\nset B["Second"]: 10\nunion A,B["Shared"]: 5'], 'title Sets',
	]),
	cynefin: snippets('Cynefin components', [
		...['complex', 'complicated', 'clear', 'chaotic', 'confusion'].map(domain => [domain, `${domain}\n  "Task"`] as const),
		'complex --> complicated : "Understood"', 'title Framework',
	]),
	wardley: snippets('Wardley components', [
		'component A [0.5, 0.5]', ['Dependency', 'component A [0.5, 0.5]\ncomponent B [0.2, 0.8]\nA->B'], 'title Value chain',
	]),
};

export const railroadComponents = {
	'railroad-beta': snippets('Grammar rules', [
		'rule = terminal("value");', 'rule = choice(terminal("first"), terminal("second"));',
		'rule = optional(terminal("value"));', 'rule = oneOrMore(terminal("value"));',
	]),
	'railroad-ebnf-beta': snippets('EBNF rules', ['rule = "value";', 'rule = "first" | "second";', 'rule = [ "value" ];', 'rule = { "value" };']),
	'railroad-abnf-beta': snippets('ABNF rules', ['rule = "value";', 'rule = "first" / "second";', 'rule = ["value"];', 'rule = 1*"value";']),
	'railroad-peg-beta': snippets('PEG rules', ['rule <- "value";', 'rule <- "first" / "second";', 'rule <- "value"?;', 'rule <- "value"+;']),
};
