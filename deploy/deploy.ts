import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDarkFiber = await deploy("DarkFiber", {
    from: deployer,
    log: true,
  });

  console.log(`DarkFiber contract: `, deployedDarkFiber.address);
};
export default func;
func.id = "deploy_darkFiber"; // id required to prevent reexecution
func.tags = ["DarkFiber"];
