import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/identity/continuity-service.test.ts', 'utf-8');

// Fix `const db = freshDb();`
content = content.replace(/const db = freshDb\(\);/g, 'const { db, agentHome } = freshDb();');

// Fix `db = freshDb();` and declarations in blocks
content = content.replace(/let db: Database\.Database;\s*beforeEach\(\(\) => {\s*db = freshDb\(\);\s*}\);/g, 
  'let db: Database.Database;\n  let agentHome: string;\n\n  beforeEach(() => {\n    const fresh = freshDb();\n    db = fresh.db;\n    agentHome = fresh.agentHome;\n  });');

content = content.replace(/let db: Database\.Database;\s*beforeEach\(\(\) => {\s*db = freshDb\(\);\s*svc = new ContinuityService\(db, silentLogger\);\s*}\);/g, 
  'let db: Database.Database;\n  let svc: ContinuityService;\n  let agentHome: string;\n\n  beforeEach(() => {\n    const fresh = freshDb();\n    db = fresh.db;\n    agentHome = fresh.agentHome;\n    svc = new ContinuityService(db, silentLogger, agentHome);\n  });');

content = content.replace(/let db: Database\.Database;\s*beforeEach\(\(\) => {\s*db = freshDb\(\);\s*svc = new ContinuityService\(db, silentLogger\);\s*svc\.hydrate\(\{ soulContent: SOUL_CONTENT, soulName: 'TestAgent' \}\);\s*}\);/g, 
  'let db: Database.Database;\n  let svc: ContinuityService;\n  let agentHome: string;\n\n  beforeEach(() => {\n    const fresh = freshDb();\n    db = fresh.db;\n    agentHome = fresh.agentHome;\n    svc = new ContinuityService(db, silentLogger, agentHome);\n    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: \'TestAgent\' });\n  });');

// Add agentHome to all `new ContinuityService(db, silentLogger)` calls
content = content.replace(/new ContinuityService\(db, silentLogger\)/g, 'new ContinuityService(db, silentLogger, agentHome)');

writeFileSync('src/identity/continuity-service.test.ts', content);
console.log('Fixed continuity-service.test.ts');
