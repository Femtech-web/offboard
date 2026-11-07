import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
  render,
} from "react-email";
import {
  approvalAccessLabel,
  approvalExpiryLabel,
  type ApprovalEmailDetails,
} from "./email-contract";

export function ApprovalEmail({
  review,
  reviewUrl,
  kind = "approval",
}: {
  review: ApprovalEmailDetails;
  reviewUrl: string;
  kind?: "approval" | "verified";
}) {
  const verified = kind === "verified";
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                canvas: "#F3F4F8",
                ink: "#151923",
                muted: "#62697A",
                line: "#E4E7EE",
                lavender: "#B4B6FF",
              },
              fontFamily: { sans: ["Neue Montreal", "Arial", "sans-serif"] },
            },
          },
        }}
      >
        <Head />
        <Preview>
          {verified ? "GitHub access removed for" : "Review GitHub access for"}{" "}
          {review.personName} at {review.target.organization}.
        </Preview>
        <Body className="bg-canvas m-0 px-4 py-10 font-sans text-ink">
          <Container className="mx-auto w-full max-w-[560px]">
            <Section className="rounded-t-2xl bg-ink px-8 py-7">
              <Text className="m-0 text-[24px] leading-8 font-bold tracking-tight text-white">
                Offboard<span className="text-lavender">.</span>
              </Text>
            </Section>
            <Section className="border-line rounded-b-2xl border border-t-0 border-solid bg-white px-8 py-8">
              <Text className="text-muted m-0 text-[11px] leading-5 font-bold tracking-[1.5px] uppercase">
                {verified ? "Verification complete" : "Your review is needed"}
              </Text>
              <Heading className="mt-3 mb-4 text-[28px] leading-9 font-bold tracking-tight">
                {verified ? (
                  <>
                    GitHub access
                    <br />
                    removed.
                  </>
                ) : (
                  <>
                    One access change.
                    <br />
                    Your decision.
                  </>
                )}
              </Heading>
              <Text className="text-muted mt-0 mb-6 text-[15px] leading-6">
                {verified
                  ? "The approved access was removed. A separate check confirmed the GitHub permission shown below is no longer present."
                  : "Please review the GitHub access proposed for removal. Nothing changes until you approve."}
              </Text>
              <Section className="border-line bg-canvas rounded-xl border border-solid px-5 py-2">
                {[
                  ["Person", review.personName],
                  ["GitHub account", `@${review.target.username}`],
                  ["Organization", review.target.organization],
                  [
                    verified ? "Verified change" : "Proposed change",
                    `${verified ? "Removed" : "Remove"} ${approvalAccessLabel(review.target.grantType).toLowerCase()}`,
                  ],
                ].map(([label, value]) => (
                  <Row key={label}>
                    <Column className="text-muted w-[122px] py-3 pr-3 align-top text-[12px] leading-5">
                      {label}
                    </Column>
                    <Column className="py-3 text-[14px] leading-5 font-medium text-ink">
                      {value}
                    </Column>
                  </Row>
                ))}
              </Section>
              <Button
                href={reviewUrl}
                className="bg-lavender mt-7 block rounded-lg px-6 py-4 text-center text-[15px] leading-5 font-bold text-ink"
              >
                {verified
                  ? "View verification report"
                  : "Review access removal"}
              </Button>
              <Text className="text-muted mt-4 mb-0 text-center text-[12px] leading-5">
                {verified
                  ? "Other systems may still need review."
                  : `No sign-in needed · Expires ${approvalExpiryLabel(review.expiresAt)}`}
              </Text>
              <Hr className="border-line my-7 border-0 border-t border-solid" />
              <Text className="text-muted m-0 text-[12px] leading-5">
                Sent to {review.recipientEmail}.{" "}
                {verified
                  ? "This summary confirms only the GitHub access shown. Full evidence is saved in your Offboard workspace."
                  : "This private link allows one decision. Please don’t forward it."}
              </Text>
            </Section>
            <Text className="text-muted mt-5 mb-0 text-center text-[11px] leading-5">
              Offboard · Access reviewed. Decisions documented.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export async function renderApprovalEmail(
  review: ApprovalEmailDetails,
  reviewUrl: string,
) {
  return render(<ApprovalEmail review={review} reviewUrl={reviewUrl} />);
}

export async function renderVerificationEmail(
  review: ApprovalEmailDetails,
  reportUrl: string,
) {
  return render(
    <ApprovalEmail review={review} reviewUrl={reportUrl} kind="verified" />,
  );
}
