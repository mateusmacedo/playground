// WHY: projetos sem manifesto (ex.: serviços Go) não têm package.json para
// guardar a versão. A fonte da verdade é a tag git `{projectName}@{version}`;
// as ações padrão do Nx para JS falham sem package.json. Sem tag anterior, o
// projeto parte de 0.0.0 e o Nx calcula o próximo número pelos conventional
// commits.
const { VersionActions } = require('nx/release');

class GitTagVersionActions extends VersionActions {
  validManifestFilenames = null;

  async validate() {}

  async readCurrentVersionFromRegistry() {
    return null;
  }

  async readCurrentVersionFromSourceManifest() {
    return {
      currentVersion: '0.0.0',
      manifestPath: 'nenhum (a versão vem da tag git)',
    };
  }

  async readCurrentVersionOfDependency() {
    return { currentVersion: null, dependencyCollection: null };
  }

  async updateProjectDependencies() {
    return [];
  }

  async updateProjectVersion() {
    return [];
  }
}

module.exports = GitTagVersionActions;
