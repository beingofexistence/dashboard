import { useAuthorizeWalletWithAccount } from "@3rdweb-sdk/react/hooks/useApi";
import {
  Container,
  Divider,
  Flex,
  FormControl,
  HStack,
  Icon,
  Input,
  VStack,
} from "@chakra-ui/react";
import { ConnectWallet, useAddress, useAuth } from "@thirdweb-dev/react";
import { AppLayout } from "components/app-layouts/app";
import { useTrack } from "hooks/analytics/useTrack";
import { useRouter } from "next/router";
import { PageId } from "page-id";
import { ReactNode, useState } from "react";
import { PiWarningFill } from "react-icons/pi";
import { Button, Card, FormLabel, Heading, Link, Text } from "tw-components";
import { ThirdwebNextPage } from "utils/types";

const LoginPage: ThirdwebNextPage = () => {
  const { payload } = useRouter().query;
  const { mutateAsync: authorizeWallet } = useAuthorizeWalletWithAccount();
  const [deviceName, setDeviceName] = useState<string>("");
  const [rejected, setRejected] = useState<boolean>(false);
  const trackEvent = useTrack();

  const address = useAddress();
  const auth = useAuth();

  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | ReactNode | undefined>(
    undefined,
  );
  const [success, setSuccess] = useState<boolean>(false);

  const generateToken = async () => {
    if (!payload) {
      trackEvent({
        category: "cli-login",
        action: "generate-token",
        label: "error",
        error: "payload not detected",
      });
      console.error("**** Payload not detected from the url! ****");
      return null;
    }
    const decodedPayload = decodeURIComponent(payload as string);
    const parsedPayload = JSON.parse(decodedPayload);
    let token;
    try {
      token = await auth?.generate(parsedPayload);
    } catch (e) {
      setLoading(false);
      setRejected(true);
      trackEvent({
        category: "cli-login",
        action: "generate-token",
        label: "error",
        reason: "failed to generate token",
        error: e,
      });
      console.error("**** Failed to generate the token! ****\n", e);
    }
    if (!token) {
      return null;
    }
    try {
      const decodedToken = auth?.parseToken(token);
      await authorizeWallet({
        token,
        deviceName: deviceName || decodedToken?.payload.sub,
      });
      trackEvent({
        category: "cli-login",
        action: "authorize-device",
        label: "success",
        deviceName,
      });
      return token;
    } catch (e) {
      setLoading(false);
      trackEvent({
        category: "cli-login",
        action: "authorize-device",
        label: "error",
        reason: "failed to authorize device",
        error: e,
      });
      console.error("**** Failed to authorize! ****\n", e);
      return null;
    }
  };

  const authorizeDevice = async () => {
    const state = window.location.hash.replace("#", "");
    setLoading(true);

    try {
      const token = await generateToken();
      if (!token) {
        setErrorText(
          <Text color="red" fontSize="lg">
            Something went wrong, please reach out to us on Discord:{" "}
            <Link color="blue.200" href="https://discord.gg/thirdweb">
              https://discord.gg/thirdweb
            </Link>
          </Text>,
        );
        setLoading(false);
        console.error(
          `Something went wrong, please reach out to us on Discord: discord.gg/thirdweb.`,
        );
        // Tell the CLI that something went wrong.
        try {
          await fetch(`http://localhost:8976/auth/callback?failed=true`, {
            method: "POST",
          });
        } catch (err) {
          console.error(err);
        }
        return null;
      }
      const response = await fetch(
        `http://localhost:8976/auth/callback?token=${token}&state=${state}`,
        {
          method: "POST",
        },
      );
      if (response.ok) {
        trackEvent({
          category: "cli-login",
          action: "return-token-to-CLI",
          label: "success",
        });
        setSuccess(true);
        setErrorText(undefined);
        setLoading(false);
      } else {
        // This should never happen, but just in case
        setErrorText(
          <Text color="red" fontSize="lg">
            Something went wrong, please reach out to us on Discord:{" "}
            <Link color="blue.200" href="https://discord.gg/thirdweb">
              https://discord.gg/thirdweb
            </Link>
          </Text>,
        );
        setLoading(false);
        console.error(
          `Something went wrong: ${response.statusText}, please reach out to us on Discord: discord.gg/thirdweb.`,
        );
        trackEvent({
          category: "cli-login",
          action: "generate-token",
          label: "error",
          reason: "Error talking to CLI server",
        });
        // Tell the CLI that something went wrong.
        try {
          await fetch(`http://localhost:8976/auth/callback?failed=true`, {
            method: "POST",
          });
        } catch (err) {
          console.error(err);
        }
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
      setErrorText(
        <Text color="red" fontSize="lg">
          Something went wrong, please reach out to us on Discord:{" "}
          <Link color="blue.200" href="https://discord.gg/thirdweb">
            https://discord.gg/thirdweb
          </Link>
        </Text>,
      );
      // Tell the CLI that something went wrong.
      try {
        await fetch(`http://localhost:8976/auth/callback?failed=true`, {
          method: "POST",
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (!address) {
    return (
      <Container maxW="lg">
        <Card p={6} as={Flex} flexDir="column" gap={2}>
          <Heading as="h2" size="title.sm">
            Connect your wallet to get started
          </Heading>
          <Text>In order to continue, you need to sign-in with a wallet.</Text>
          <Divider my={4} />
          <ConnectWallet />
        </Card>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxW="container.lg" overflow="hidden" h="full">
        <Flex
          justify="center"
          flexDir="column"
          justifyContent="center"
          alignItems="center"
          h="full"
          gap={8}
        >
          <VStack>
            <Heading>Your device is now linked to your account.</Heading>
            <Text fontSize="3xl">You may close this tab now.</Text>
          </VStack>
        </Flex>
      </Container>
    );
  }

  if (rejected) {
    return (
      <Container maxW="container.lg" overflow="hidden" h="full">
        <Flex
          justify="center"
          flexDir="column"
          justifyContent="center"
          alignItems="center"
          h="full"
          gap={8}
        >
          <VStack>
            <Heading>
              You rejected the signature, your device was not linked.
            </Heading>
            <Text fontSize="3xl">You may close this tab now.</Text>
          </VStack>
        </Flex>
      </Container>
    );
  }

  return (
    <Container maxW="container.lg" overflow="hidden" h="full">
      <Flex
        justify="center"
        flexDir="column"
        h="full"
        alignItems="start"
        textAlign="start"
      >
        <Heading mb={4}>Link this device to your thirdweb account</Heading>
        <Text mb={8}>
          By clicking the button below you are authorizing this device to take
          actions that will be linked to your thirdweb account. You will need to
          sign a transaction with the wallet that you use with thirdweb. This
          needs to be done only once per device. You can revoke device access
          through the settings page.
        </Text>
        <FormControl mb={8}>
          <FormLabel>
            Device name{" "}
            <Text fontWeight="thin" as="i">
              (optional)
            </Text>
          </FormLabel>
          <Text mb={2}>
            This is useful to identify which devices have access to your account
          </Text>
          <Input
            placeholder="Eg. work laptop"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            isDisabled={loading}
            maxWidth={600}
          />
        </FormControl>
        <Button
          variant="outline"
          isDisabled={!address}
          isLoading={loading}
          onClick={authorizeDevice}
        >
          Authorize device
        </Button>
        <Text as="i" my={2} mb={8} size="label.sm" fontWeight="thin">
          Signing the transaction is gasless
        </Text>
        {errorText}
        <Card>
          <HStack>
            <Icon as={PiWarningFill} mr={2} fontSize={24} />
            <Text fontSize="md" fontWeight="medium">
              Do not authorize access if this link was sent to you, it could be
              used to perform actions on your account without your knowledge.
            </Text>
          </HStack>
        </Card>
      </Flex>
    </Container>
  );
};

LoginPage.getLayout = (page, props) => (
  <AppLayout layout="custom-contract" {...props}>
    {page}
  </AppLayout>
);
LoginPage.pageId = PageId.CliLoginPage;

export default LoginPage;
